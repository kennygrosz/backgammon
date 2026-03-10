import { create } from 'zustand';
import type { GameState, Player, Move, BoardState, DiceRoll } from '../engine/types';
import { createInitialBoard, cloneBoard } from '../engine/board';
import { rollDice, diceToValues } from '../engine/dice';
import { applyMove, generateLegalTurns, getLegalMovesFrom, getMovableSources } from '../engine/moves';
import { checkWinner, getWinType } from '../engine/rules';
import {
  fetchGame,
  joinGame,
  updateGameState,
  type DbGame,
} from '../services/gameService';

interface GameStore {
  // DB state
  gameId: string | null;
  myColor: Player | null;
  whiteUsername: string | null;
  blackUsername: string | null;
  dbStatus: string | null;

  // Local game state
  game: GameState;
  selectedSource: number | 'bar' | null;
  legalDestinations: Move[];
  movableSources: (number | 'bar')[];
  autoPassMessage: string | null;
  turnComplete: boolean;
  loading: boolean;
  saving: boolean; // true while a DB write + read-back is in flight

  // Actions
  loadGame: (gameId: string, userId: string) => Promise<void>;
  applyRemoteState: (db: DbGame) => void;
  roll: () => void;
  selectSource: (source: number | 'bar') => void;
  clearSelection: () => void;
  makeMove: (move: Move) => void;
  undoLastMove: () => void;
  submitTurn: () => Promise<void>;
}

function dbToGameState(db: DbGame): GameState {
  return {
    board: db.board_state as BoardState,
    currentPlayer: db.current_player as Player,
    dice: db.dice as DiceRoll | null,
    remainingDice: (db.remaining_dice ?? []) as number[],
    turnMoves: [],
    boardSnapshots: [],
    status: (db.status === 'waiting' ? 'rolling' : db.status) as GameState['status'],
    winner: db.winner as Player | null,
    winType: db.win_type as GameState['winType'],
  };
}

function createEmptyGame(): GameState {
  return {
    board: createInitialBoard(),
    currentPlayer: 'white',
    dice: null,
    remainingDice: [],
    turnMoves: [],
    boardSnapshots: [],
    status: 'rolling',
    winner: null,
    winType: null,
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameId: null,
  myColor: null,
  whiteUsername: null,
  blackUsername: null,
  dbStatus: null,
  game: createEmptyGame(),
  selectedSource: null,
  legalDestinations: [],
  movableSources: [],
  autoPassMessage: null,
  turnComplete: false,
  loading: true,
  saving: false,

  loadGame: async (gameId: string, userId: string) => {
    set({ loading: true, gameId, autoPassMessage: null });

    let dbGame = await fetchGame(gameId);
    if (!dbGame) {
      set({ loading: false });
      return;
    }

    // Auto-join if the game is waiting and user isn't already a player
    const isPlayer = dbGame.white_player_id === userId || dbGame.black_player_id === userId;
    if (!isPlayer && dbGame.status === 'waiting' && !dbGame.black_player_id) {
      const joined = await joinGame(gameId, userId);
      if (joined) {
        dbGame = await fetchGame(gameId) ?? dbGame;
      }
    }

    const myColor: Player | null =
      dbGame.white_player_id === userId ? 'white' :
      dbGame.black_player_id === userId ? 'black' : null;

    set({
      game: dbToGameState(dbGame),
      myColor,
      whiteUsername: dbGame.white_profile?.username ?? null,
      blackUsername: dbGame.black_profile?.username ?? null,
      dbStatus: dbGame.status,
      loading: false,
      selectedSource: null,
      legalDestinations: [],
      movableSources: [],
      turnComplete: false,
    });
  },

  applyRemoteState: (db: DbGame) => {
    const { saving, game } = get();

    // Never apply while a DB write + read-back is in progress
    if (saving) return;

    // Ignore remote data that matches our current local state exactly
    // (prevents no-op re-renders and guards against stale echoes)
    const dbStatus = db.status === 'waiting' ? 'rolling' : db.status;
    if (
      db.current_player === game.currentPlayer &&
      dbStatus === game.status &&
      get().dbStatus !== 'waiting' // always apply waiting→rolling transitions
    ) {
      return;
    }

    console.log('[SYNC] applying remote state:', db.current_player, db.status);
    const updatedGame = dbToGameState(db);
    set({
      game: updatedGame,
      dbStatus: db.status,
      whiteUsername: db.white_profile?.username ?? get().whiteUsername,
      blackUsername: db.black_profile?.username ?? get().blackUsername,
      selectedSource: null,
      legalDestinations: [],
      movableSources: [],
      turnComplete: false,
      autoPassMessage: null,
    });
  },

  roll: () => {
    const { game, myColor, gameId } = get();
    if (game.status !== 'rolling' || !myColor || !gameId) return;
    if (game.currentPlayer !== myColor) return;

    const dice = rollDice();
    const remainingDice = diceToValues(dice);
    const newGame: GameState = {
      ...game,
      dice,
      remainingDice,
      status: 'moving',
      boardSnapshots: [],
      turnMoves: [],
    };

    const movable = getMovableSources(newGame.board, newGame.currentPlayer, remainingDice);

    // Auto-pass if no moves available
    if (movable.length === 0 || generateLegalTurns(newGame.board, newGame.currentPlayer, remainingDice)[0].length === 0) {
      const nextPlayer: Player = newGame.currentPlayer === 'white' ? 'black' : 'white';
      const pName = newGame.currentPlayer === 'white' ? 'White' : 'Blue';

      const passedGame: GameState = {
        ...newGame,
        status: 'rolling',
        currentPlayer: nextPlayer,
        remainingDice: [],
        dice: null,
      };

      // Set saving flag so poll doesn't interfere
      set({
        game: passedGame,
        saving: true,
        selectedSource: null,
        legalDestinations: [],
        movableSources: [],
        autoPassMessage: `${pName} rolled ${dice[0]}-${dice[1]} but has no legal moves. Turn passed.`,
        turnComplete: false,
      });

      updateGameState(gameId, {
        board_state: passedGame.board,
        current_player: nextPlayer,
        dice: null,
        remaining_dice: [],
        status: 'rolling',
      }).then(async (ok) => {
        if (ok) {
          const verified = await fetchGame(gameId);
          if (verified) {
            set({ game: dbToGameState(verified), saving: false });
            return;
          }
        }
        set({ saving: false });
      }).catch(() => set({ saving: false }));
      return;
    }

    // Don't persist the roll to DB here — it will be saved when the turn
    // is submitted. A fire-and-forget update here races with submitTurn()
    // and can overwrite the final board state if it arrives at the server late.

    set({
      game: newGame,
      movableSources: movable,
      selectedSource: null,
      legalDestinations: [],
      autoPassMessage: null,
      turnComplete: false,
    });
  },

  selectSource: (source: number | 'bar') => {
    const { game, selectedSource, turnComplete, myColor } = get();
    if (game.status !== 'moving' || turnComplete) return;
    if (game.currentPlayer !== myColor) return;

    if (selectedSource === source) {
      set({ selectedSource: null, legalDestinations: [] });
      return;
    }

    const moves = getLegalMovesFrom(game.board, game.currentPlayer, game.remainingDice, source);
    if (moves.length === 0) return;

    if (moves.length === 1) {
      get().makeMove(moves[0]);
      return;
    }

    set({ selectedSource: source, legalDestinations: moves });
  },

  clearSelection: () => {
    set({ selectedSource: null, legalDestinations: [] });
  },

  makeMove: (move: Move) => {
    const { game, turnComplete, myColor } = get();
    if (game.status !== 'moving' || turnComplete) return;
    if (game.currentPlayer !== myColor) return;

    const snapshot = cloneBoard(game.board);
    const newBoard = applyMove(game.board, move, game.currentPlayer);
    const newRemaining = [...game.remainingDice];
    const idx = newRemaining.indexOf(move.dieUsed);
    if (idx !== -1) newRemaining.splice(idx, 1);

    const winner = checkWinner(newBoard);

    const newGame: GameState = {
      ...game,
      board: newBoard,
      remainingDice: newRemaining,
      turnMoves: [...game.turnMoves, move],
      boardSnapshots: [...game.boardSnapshots, snapshot],
      winner,
      winType: winner ? getWinType(newBoard, winner) : null,
      status: winner ? 'finished' : game.status,
    };

    if (winner) {
      set({
        game: newGame,
        selectedSource: null,
        legalDestinations: [],
        movableSources: [],
        turnComplete: false,
      });

      const { gameId } = get();
      if (gameId) {
        set({ saving: true });
        updateGameState(gameId, {
          board_state: newBoard,
          current_player: game.currentPlayer,
          dice: null,
          remaining_dice: [],
          status: 'finished',
          winner,
          win_type: newGame.winType,
        }).finally(() => set({ saving: false }));
      }
      return;
    }

    if (newRemaining.length > 0) {
      const movable = getMovableSources(newBoard, game.currentPlayer, newRemaining);
      const legalTurns = generateLegalTurns(newBoard, game.currentPlayer, newRemaining);
      const hasLegalMoves = legalTurns.some(t => t.length > 0);

      if (!hasLegalMoves || movable.length === 0) {
        set({
          game: newGame,
          selectedSource: null,
          legalDestinations: [],
          movableSources: [],
          turnComplete: true,
        });
        return;
      }

      set({
        game: newGame,
        movableSources: movable,
        selectedSource: null,
        legalDestinations: [],
      });
      return;
    }

    set({
      game: newGame,
      selectedSource: null,
      legalDestinations: [],
      movableSources: [],
      turnComplete: true,
    });
  },

  undoLastMove: () => {
    const { game, myColor } = get();
    if (game.turnMoves.length === 0) return;
    if (game.currentPlayer !== myColor) return;

    const newSnapshots = [...game.boardSnapshots];
    const restoredBoard = newSnapshots.pop()!;
    const newMoves = [...game.turnMoves];
    const undoneMove = newMoves.pop()!;
    const newRemaining = [...game.remainingDice, undoneMove.dieUsed];

    const newGame: GameState = {
      ...game,
      board: restoredBoard,
      remainingDice: newRemaining,
      turnMoves: newMoves,
      boardSnapshots: newSnapshots,
      status: 'moving',
      winner: null,
      winType: null,
    };

    const movable = getMovableSources(restoredBoard, game.currentPlayer, newRemaining);

    set({
      game: newGame,
      movableSources: movable,
      selectedSource: null,
      legalDestinations: [],
      turnComplete: false,
    });
  },

  submitTurn: async () => {
    const { game, gameId } = get();
    if (game.turnMoves.length === 0 || !gameId) return;

    const nextPlayer: Player = game.currentPlayer === 'white' ? 'black' : 'white';

    const updatedGame: GameState = {
      ...game,
      status: 'rolling',
      currentPlayer: nextPlayer,
      remainingDice: [],
      dice: null,
      turnMoves: [],
      boardSnapshots: [],
    };

    const payload = {
      board_state: updatedGame.board,
      current_player: nextPlayer,
      dice: null as DiceRoll | null,
      remaining_dice: [] as number[],
      status: 'rolling',
    };

    // Set saving flag so poll/realtime don't interfere
    set({
      game: updatedGame,
      saving: true,
      selectedSource: null,
      legalDestinations: [],
      movableSources: [],
      turnComplete: false,
    });

    // Persist to DB — retry once on failure
    let ok = await updateGameState(gameId, payload);
    if (!ok) {
      console.warn('[SUBMIT] first attempt failed, retrying…');
      ok = await updateGameState(gameId, payload);
    }
    if (!ok) {
      console.error('[SUBMIT] DB update failed after retry — reloading game state');
      const fresh = await fetchGame(gameId);
      if (fresh) {
        set({ game: dbToGameState(fresh), saving: false });
      } else {
        set({ saving: false });
      }
      return;
    }

    // Read back from DB to confirm the write persisted.
    // Keep saving=true the entire time so no poll/realtime can interfere.
    const verified = await fetchGame(gameId);
    if (verified) {
      console.log('[SUBMIT] verified — DB has:', verified.current_player, verified.status);
      set({ game: dbToGameState(verified), saving: false });
    } else {
      set({ saving: false });
    }
  },
}));
