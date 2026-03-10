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
  dbStatus: string | null; // 'waiting' | 'rolling' | 'moving' | 'finished'

  // Local game state
  game: GameState;
  selectedSource: number | 'bar' | null;
  legalDestinations: Move[];
  movableSources: (number | 'bar')[];
  autoPassMessage: string | null;
  turnComplete: boolean;
  loading: boolean;

  // Actions
  loadGame: (gameId: string, userId: string) => Promise<void>;
  applyRemoteState: (db: DbGame) => void;
  roll: () => void;
  selectSource: (source: number | 'bar') => void;
  clearSelection: () => void;
  makeMove: (move: Move) => void;
  undoLastMove: () => void;
  submitTurn: () => void;
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
    if (game.currentPlayer !== myColor) return; // not your turn

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
      const playerName = newGame.currentPlayer === 'white' ? 'White' : 'Blue';

      const passedGame: GameState = {
        ...newGame,
        status: 'rolling',
        currentPlayer: nextPlayer,
        remainingDice: [],
        dice: null,
      };

      set({
        game: passedGame,
        selectedSource: null,
        legalDestinations: [],
        movableSources: [],
        autoPassMessage: `${playerName} rolled ${dice[0]}-${dice[1]} but has no legal moves. Turn passed.`,
        turnComplete: false,
      });

      // Persist the pass
      updateGameState(gameId, {
        board_state: passedGame.board,
        current_player: nextPlayer,
        dice: null,
        remaining_dice: [],
        status: 'rolling',
      });
      return;
    }

    // Persist the roll so opponent sees the dice
    updateGameState(gameId, {
      board_state: newGame.board,
      current_player: newGame.currentPlayer,
      dice,
      remaining_dice: remainingDice,
      status: 'moving',
    });

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

      // Persist win
      const { gameId } = get();
      if (gameId) {
        updateGameState(gameId, {
          board_state: newBoard,
          current_player: game.currentPlayer,
          dice: null,
          remaining_dice: [],
          status: 'finished',
          winner,
          win_type: newGame.winType,
        });
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

  submitTurn: () => {
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

    set({
      game: updatedGame,
      selectedSource: null,
      legalDestinations: [],
      movableSources: [],
      turnComplete: false,
    });

    // Persist to DB
    updateGameState(gameId, {
      board_state: updatedGame.board,
      current_player: nextPlayer,
      dice: null,
      remaining_dice: [],
      status: 'rolling',
    });
  },
}));
