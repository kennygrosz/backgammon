import { create } from 'zustand';
import type { GameState, Player, Move } from '../engine/types';
import { createInitialBoard, cloneBoard } from '../engine/board';
import { rollDice, diceToValues } from '../engine/dice';
import { applyMove, generateLegalTurns, getLegalMovesFrom, getMovableSources } from '../engine/moves';
import { checkWinner, getWinType } from '../engine/rules';

interface GameStore {
  game: GameState;
  selectedSource: number | 'bar' | null;
  legalDestinations: Move[];
  movableSources: (number | 'bar')[];
  autoPassMessage: string | null;
  turnComplete: boolean;

  newGame: () => void;
  roll: () => void;
  selectSource: (source: number | 'bar') => void;
  clearSelection: () => void;
  makeMove: (move: Move) => void;
  undoLastMove: () => void;
  submitTurn: () => void;
}

function createNewGame(): GameState {
  const board = createInitialBoard();
  return {
    board,
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
  game: createNewGame(),
  selectedSource: null,
  legalDestinations: [],
  movableSources: [],
  autoPassMessage: null,
  turnComplete: false,

  newGame: () => {
    set({
      game: createNewGame(),
      selectedSource: null,
      legalDestinations: [],
      movableSources: [],
      autoPassMessage: null,
      turnComplete: false,
    });
  },

  roll: () => {
    const { game } = get();
    if (game.status !== 'rolling') return;

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
      set({
        game: { ...newGame, status: 'rolling', currentPlayer: nextPlayer, remainingDice: [], dice: null },
        selectedSource: null,
        legalDestinations: [],
        movableSources: [],
        autoPassMessage: `${playerName} rolled ${dice[0]}-${dice[1]} but has no legal moves. Turn passed.`,
        turnComplete: false,
      });
      return;
    }

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
    const { game, selectedSource, turnComplete } = get();
    if (game.status !== 'moving' || turnComplete) return;

    // Deselect if tapping the same source
    if (selectedSource === source) {
      set({ selectedSource: null, legalDestinations: [] });
      return;
    }

    const moves = getLegalMovesFrom(game.board, game.currentPlayer, game.remainingDice, source);
    if (moves.length === 0) return;

    // If only one legal move from this source, auto-execute it
    if (moves.length === 1) {
      get().makeMove(moves[0]);
      return;
    }

    set({
      selectedSource: source,
      legalDestinations: moves,
    });
  },

  clearSelection: () => {
    set({ selectedSource: null, legalDestinations: [] });
  },

  makeMove: (move: Move) => {
    const { game, turnComplete } = get();
    if (game.status !== 'moving' || turnComplete) return;

    // Save snapshot before this move
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

    // Game over — no need for End Turn
    if (winner) {
      set({
        game: newGame,
        selectedSource: null,
        legalDestinations: [],
        movableSources: [],
        turnComplete: false,
      });
      return;
    }

    // Check if more moves are possible
    if (newRemaining.length > 0) {
      const movable = getMovableSources(newBoard, game.currentPlayer, newRemaining);
      const legalTurns = generateLegalTurns(newBoard, game.currentPlayer, newRemaining);
      const hasLegalMoves = legalTurns.some(t => t.length > 0);

      if (!hasLegalMoves || movable.length === 0) {
        // No more legal moves — wait for End Turn
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

    // All dice used — wait for End Turn
    set({
      game: newGame,
      selectedSource: null,
      legalDestinations: [],
      movableSources: [],
      turnComplete: true,
    });
  },

  undoLastMove: () => {
    const { game } = get();
    if (game.turnMoves.length === 0) return;

    const newSnapshots = [...game.boardSnapshots];
    const restoredBoard = newSnapshots.pop()!;
    const newMoves = [...game.turnMoves];
    const undoneMove = newMoves.pop()!;

    // Restore the die that was used
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
    const { game } = get();
    if (game.turnMoves.length === 0) return;

    const nextPlayer: Player = game.currentPlayer === 'white' ? 'black' : 'white';
    set({
      game: {
        ...game,
        status: 'rolling',
        currentPlayer: nextPlayer,
        remainingDice: [],
        dice: null,
        turnMoves: [],
        boardSnapshots: [],
      },
      selectedSource: null,
      legalDestinations: [],
      movableSources: [],
      turnComplete: false,
    });
  },
}));
