import type { BoardState, Player } from './types.js';

// Standard backgammon starting position
// White (positive) moves from point 24 toward point 1 (high index → low index)
// Black (negative) moves from point 1 toward point 24 (low index → high index)
export function createInitialBoard(): BoardState {
  const points = new Array(24).fill(0);

  // White (positive) starts far from home — moves toward points 1-6
  points[23] = 2;   // point 24: 2 white
  points[12] = 5;   // point 13: 5 white
  points[7] = 3;    // point 8: 3 white
  points[5] = 5;    // point 6: 5 white

  // Black (negative) starts far from home — moves toward points 19-24
  points[0] = -2;   // point 1: 2 black
  points[11] = -5;  // point 12: 5 black
  points[16] = -3;  // point 17: 3 black
  points[18] = -5;  // point 19: 5 black

  return {
    points,
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 },
  };
}

export function cloneBoard(board: BoardState): BoardState {
  return {
    points: [...board.points],
    bar: { ...board.bar },
    borneOff: { ...board.borneOff },
  };
}

// Direction of movement for each player
// White moves from high index to low index (e.g., point 24 → point 1)
// Black moves from low index to high index (e.g., point 1 → point 24)
export function moveDirection(player: Player): number {
  return player === 'white' ? -1 : 1;
}

// Bar entry point index for a player (where they re-enter from the bar)
// White enters at point 24 area (index 23) and moves down
// Black enters at point 1 area (index 0) and moves up
export function barEntryStart(player: Player): number {
  return player === 'white' ? 24 : -1;
}

// Home board range for a player (indices, inclusive)
// White's home board: points 1-6 (indices 0-5)
// Black's home board: points 19-24 (indices 18-23)
export function homeBoard(player: Player): [number, number] {
  return player === 'white' ? [0, 5] : [18, 23];
}

// Check if all of a player's checkers are in their home board (or borne off)
export function allInHomeBoard(board: BoardState, player: Player): boolean {
  const [homeStart, homeEnd] = homeBoard(player);
  const isOwn = player === 'white' ? (v: number) => v > 0 : (v: number) => v < 0;

  // No checkers on the bar
  if (board.bar[player] > 0) return false;

  // No checkers outside home board
  for (let i = 0; i < 24; i++) {
    if (i >= homeStart && i <= homeEnd) continue;
    if (isOwn(board.points[i])) return false;
  }
  return true;
}

// Get the count of a player's checkers on a point (always positive)
export function checkerCount(board: BoardState, point: number, player: Player): number {
  const val = board.points[point];
  if (player === 'white') return val > 0 ? val : 0;
  return val < 0 ? -val : 0;
}

// Check if a point is owned by a player (has 2+ checkers)
export function isBlocked(board: BoardState, point: number, player: Player): boolean {
  return checkerCount(board, point, player) >= 2;
}

// Get the destination index for a move from a given point with a given die
// Returns -1 if the move goes off the board (bearing off)
export function destinationIndex(from: number | 'bar', die: number, player: Player): number {
  const start = from === 'bar' ? barEntryStart(player) : from;
  const dest = start + die * moveDirection(player);
  return dest;
}
