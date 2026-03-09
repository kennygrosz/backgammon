import type { BoardState, Move, Player } from './types.js';
import { allInHomeBoard, cloneBoard, homeBoard, moveDirection, barEntryStart } from './board.js';

const opponent = (p: Player): Player => (p === 'white' ? 'black' : 'white');

// Can a player land on this point?
function canLandOn(board: BoardState, point: number, player: Player): boolean {
  if (point < 0 || point > 23) return false;
  const val = board.points[point];
  if (player === 'white') return val >= -1; // empty, own, or single opponent (blot)
  return val <= 1;
}

// Apply a single move to a board (mutates the board)
export function applyMoveMut(board: BoardState, move: Move, player: Player): void {
  const opp = opponent(player);
  const sign = player === 'white' ? 1 : -1;

  // Remove checker from source
  if (move.from === 'bar') {
    board.bar[player]--;
  } else {
    board.points[move.from] -= sign;
  }

  // Place checker at destination
  if (move.to === 'off') {
    board.borneOff[player]++;
  } else {
    // Hit opponent blot
    if (move.hit) {
      board.points[move.to] = 0;
      board.bar[opp]++;
    }
    board.points[move.to] += sign;
  }
}

// Apply a move immutably
export function applyMove(board: BoardState, move: Move, player: Player): BoardState {
  const newBoard = cloneBoard(board);
  applyMoveMut(newBoard, move, player);
  return newBoard;
}

// Generate all individual moves for a specific die value from a specific position
function generateMovesForDie(
  board: BoardState,
  player: Player,
  die: number,
  from: number | 'bar'
): Move | null {
  const dir = moveDirection(player);
  const start = from === 'bar' ? barEntryStart(player) : from;
  const dest = start + die * dir;

  // Bearing off
  if (from !== 'bar' && allInHomeBoard(board, player)) {
    const [homeStart, homeEnd] = homeBoard(player);

    if (player === 'white' && dest < 0) {
      // Check if exact or highest checker
      const exact = dest === -1;
      if (!exact) {
        // Can only bear off with a higher die if no checkers on higher points
        for (let i = homeEnd; i > from; i--) {
          if ((player === 'white' && board.points[i] > 0)) return null;
        }
      }
      return { from, to: 'off', dieUsed: die, hit: false };
    }

    if (player === 'black' && dest > 23) {
      const exact = dest === 24;
      if (!exact) {
        for (let i = homeStart; i < from; i++) {
          if (board.points[i] < 0) return null;
        }
      }
      return { from, to: 'off', dieUsed: die, hit: false };
    }
  }

  // Normal move
  if (dest < 0 || dest > 23) return null;
  if (!canLandOn(board, dest, player)) return null;

  const oppSign = player === 'white' ? -1 : 1;
  const hit = board.points[dest] === oppSign; // exactly 1 opponent checker

  return { from, to: dest, dieUsed: die, hit };
}

// Get all possible single moves for a player given remaining dice
function getAllSingleMoves(board: BoardState, player: Player, die: number): Move[] {
  const moves: Move[] = [];
  const sign = player === 'white' ? 1 : -1;

  // Must enter from bar first
  if (board.bar[player] > 0) {
    const move = generateMovesForDie(board, player, die, 'bar');
    if (move) moves.push(move);
    return moves; // Can only move from bar when checkers are on bar
  }

  // Try all points with player's checkers
  for (let i = 0; i < 24; i++) {
    if (board.points[i] * sign > 0) {
      const move = generateMovesForDie(board, player, die, i);
      if (move) moves.push(move);
    }
  }

  return moves;
}

// Find all possible complete turns (sequences of moves using maximum dice)
// Uses recursive backtracking
function findAllTurns(
  board: BoardState,
  player: Player,
  remainingDice: number[],
  movesSoFar: Move[]
): Move[][] {
  if (remainingDice.length === 0) return [movesSoFar];

  const results: Move[][] = [];
  const triedDice = new Set<number>();

  for (let i = 0; i < remainingDice.length; i++) {
    const die = remainingDice[i];
    if (triedDice.has(die)) continue;
    triedDice.add(die);

    const singleMoves = getAllSingleMoves(board, player, die);

    for (const move of singleMoves) {
      const newBoard = applyMove(board, move, player);
      const newRemaining = [...remainingDice];
      newRemaining.splice(i, 1);
      const continuations = findAllTurns(newBoard, player, newRemaining, [...movesSoFar, move]);
      results.push(...continuations);
    }
  }

  // If no moves possible with any remaining die, this is a terminal state
  if (results.length === 0) {
    return [movesSoFar];
  }

  return results;
}

// Get the maximum number of dice that can be used in any complete turn
export function generateLegalTurns(
  board: BoardState,
  player: Player,
  remainingDice: number[]
): Move[][] {
  const allTurns = findAllTurns(board, player, remainingDice, []);

  // Find maximum number of dice used
  const maxDice = Math.max(...allTurns.map(t => t.length));

  if (maxDice === 0) return [[]]; // No moves possible

  // Filter to only turns that use the maximum number of dice
  let validTurns = allTurns.filter(t => t.length === maxDice);

  // Special rule: if only one die can be used (not doubles), must use the higher one
  if (remainingDice.length === 2 && remainingDice[0] !== remainingDice[1] && maxDice === 1) {
    const turnsWithHigher = validTurns.filter(t => t[0].dieUsed === Math.max(...remainingDice));
    if (turnsWithHigher.length > 0) {
      validTurns = turnsWithHigher;
    }
  }

  return validTurns;
}

// Get legal moves from a specific position given the current state
// Used for UI: player taps a checker, we highlight where it can go
export function getLegalMovesFrom(
  board: BoardState,
  player: Player,
  remainingDice: number[],
  from: number | 'bar'
): Move[] {
  const legalTurns = generateLegalTurns(board, player, remainingDice);
  const movesFromHere: Move[] = [];
  const seen = new Set<string>();

  for (const turn of legalTurns) {
    if (turn.length > 0 && turn[0].from === from) {
      const key = `${turn[0].to}-${turn[0].dieUsed}`;
      if (!seen.has(key)) {
        seen.add(key);
        movesFromHere.push(turn[0]);
      }
    }
  }

  return movesFromHere;
}

// Get all points/bar that have legal first moves
export function getMovableSources(
  board: BoardState,
  player: Player,
  remainingDice: number[]
): (number | 'bar')[] {
  const legalTurns = generateLegalTurns(board, player, remainingDice);
  const sources = new Set<number | 'bar'>();

  for (const turn of legalTurns) {
    if (turn.length > 0) {
      sources.add(turn[0].from);
    }
  }

  return Array.from(sources);
}
