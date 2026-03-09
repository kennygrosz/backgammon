import { describe, it, expect } from 'vitest';
import { createInitialBoard } from '../board';
import { generateLegalTurns, getLegalMovesFrom, applyMove, getMovableSources } from '../moves';
import type { BoardState } from '../types';

function emptyBoard(): BoardState {
  return {
    points: new Array(24).fill(0),
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 },
  };
}

describe('generateLegalTurns', () => {
  it('should generate moves from initial position', () => {
    const board = createInitialBoard();
    const turns = generateLegalTurns(board, 'white', [3, 1]);
    expect(turns.length).toBeGreaterThan(0);
    // Every turn should use both dice
    for (const turn of turns) {
      expect(turn.length).toBe(2);
    }
  });

  it('should handle doubles (4 moves)', () => {
    const board = createInitialBoard();
    const turns = generateLegalTurns(board, 'white', [6, 6, 6, 6]);
    for (const turn of turns) {
      // Should use as many dice as possible
      expect(turn.length).toBeGreaterThan(0);
    }
  });

  it('should return empty turn when no moves possible', () => {
    const board = emptyBoard();
    // White has one checker on point 1, blocked by black on all entry points
    board.points[0] = 1; // white on point 1
    board.points.fill(0);
    board.points[0] = 1;
    // Block all possible destinations
    // White moves from high to low. With die 1 from index 0, dest = -1 (off board, but not in home board with all checkers)
    // Actually let's set up a real blocked scenario
    board.bar.white = 1;
    // Black blocks all bar entry points (indices 23, 22, 21, 20, 19, 18)
    board.points[23] = -2;
    board.points[22] = -2;
    board.points[21] = -2;
    board.points[20] = -2;
    board.points[19] = -2;
    board.points[18] = -2;

    const turns = generateLegalTurns(board, 'white', [3, 5]);
    expect(turns.length).toBe(1);
    expect(turns[0].length).toBe(0); // No moves possible
  });

  it('should force bar entry before other moves', () => {
    const board = emptyBoard();
    board.bar.white = 1;
    board.points[5] = 3; // 3 white on point 6
    board.points[23] = 0; // empty point 24 (bar entry for white)
    board.borneOff.white = 11;

    const turns = generateLegalTurns(board, 'white', [1, 2]);
    for (const turn of turns) {
      expect(turn[0].from).toBe('bar');
    }
  });

  it('should prefer higher die when only one can be used', () => {
    const board = emptyBoard();
    // Single white checker at index 10
    board.points[10] = 1;
    board.borneOff.white = 14;
    // Die 3: 10→7 (blocked). Die 5: 10→5 (open), then die 3: 5→2 (blocked).
    // So only 1 die can be used. Higher die (5) must be preferred.
    board.points[7] = -2;
    board.points[2] = -2;

    const turns = generateLegalTurns(board, 'white', [3, 5]);
    expect(turns.length).toBeGreaterThan(0);
    for (const turn of turns) {
      expect(turn.length).toBe(1);
      expect(turn[0].dieUsed).toBe(5);
    }
  });
});

describe('bearing off', () => {
  it('should allow bearing off with exact die', () => {
    const board = emptyBoard();
    board.points[2] = 1; // white on point 3
    board.borneOff.white = 14;

    const turns = generateLegalTurns(board, 'white', [3, 1]);
    const bearOffTurns = turns.filter(t => t.some(m => m.to === 'off'));
    expect(bearOffTurns.length).toBeGreaterThan(0);
  });

  it('should allow bearing off with higher die when no checker behind', () => {
    const board = emptyBoard();
    board.points[1] = 1; // white on point 2
    board.borneOff.white = 14;

    // Die 5 is higher than needed (point 2 only needs die 2)
    // But since no checker is on a higher point, it should be allowed
    const turns = generateLegalTurns(board, 'white', [5, 6]);
    const bearOffTurns = turns.filter(t => t.some(m => m.to === 'off'));
    expect(bearOffTurns.length).toBeGreaterThan(0);
  });

  it('should not allow bearing off when checkers outside home board', () => {
    const board = emptyBoard();
    board.points[1] = 1;  // white on point 2 (home board)
    board.points[10] = 1; // white on point 11 (NOT home board)
    board.borneOff.white = 13;

    const turns = generateLegalTurns(board, 'white', [2, 3]);
    const bearOffTurns = turns.filter(t => t.some(m => m.to === 'off'));
    expect(bearOffTurns.length).toBe(0);
  });

  it('should work for black bearing off', () => {
    const board = emptyBoard();
    board.points[22] = -1; // black on point 23
    board.borneOff.black = 14;

    const turns = generateLegalTurns(board, 'black', [2, 3]);
    const bearOffTurns = turns.filter(t => t.some(m => m.to === 'off'));
    expect(bearOffTurns.length).toBeGreaterThan(0);
  });
});

describe('hitting', () => {
  it('should hit a blot', () => {
    const board = emptyBoard();
    board.points[10] = 1;  // white on point 11
    board.points[7] = -1;  // black blot on point 8
    board.borneOff.white = 14;

    const turns = generateLegalTurns(board, 'white', [3, 1]);
    const hitTurns = turns.filter(t => t.some(m => m.hit));
    expect(hitTurns.length).toBeGreaterThan(0);
  });

  it('should not land on blocked point', () => {
    const board = emptyBoard();
    board.points[10] = 1;  // white on point 11
    board.points[7] = -2;  // black 2-stack on point 8 (blocked)
    board.borneOff.white = 14;

    const moves = getLegalMovesFrom(board, 'white', [3, 1], 10);
    const toBlocked = moves.filter(m => m.to === 7);
    expect(toBlocked.length).toBe(0);
  });
});

describe('applyMove', () => {
  it('should move a checker', () => {
    const board = createInitialBoard();
    // White has 5 on point 13 (index 12), move 3 to point 10 (index 9)
    const move = { from: 12 as number, to: 9, dieUsed: 3, hit: false };
    const newBoard = applyMove(board, move, 'white');
    expect(newBoard.points[12]).toBe(4); // was 5, now 4
    expect(newBoard.points[9]).toBe(1);
    // Original unchanged
    expect(board.points[12]).toBe(5);
  });

  it('should handle hitting', () => {
    const board = emptyBoard();
    board.points[10] = 1;
    board.points[7] = -1; // blot
    const move = { from: 10 as number, to: 7, dieUsed: 3, hit: true };
    const newBoard = applyMove(board, move, 'white');
    expect(newBoard.points[7]).toBe(1); // white now
    expect(newBoard.bar.black).toBe(1);
  });

  it('should handle bar entry', () => {
    const board = emptyBoard();
    board.bar.white = 1;
    const move = { from: 'bar' as const, to: 22, dieUsed: 2, hit: false };
    const newBoard = applyMove(board, move, 'white');
    expect(newBoard.bar.white).toBe(0);
    expect(newBoard.points[22]).toBe(1);
  });

  it('should handle bearing off', () => {
    const board = emptyBoard();
    board.points[2] = 1;
    const move = { from: 2 as number, to: 'off' as const, dieUsed: 3, hit: false };
    const newBoard = applyMove(board, move, 'white');
    expect(newBoard.points[2]).toBe(0);
    expect(newBoard.borneOff.white).toBe(1);
  });
});

describe('getMovableSources', () => {
  it('should return bar when checker is on bar', () => {
    const board = emptyBoard();
    board.bar.white = 1;
    board.points[5] = 3;
    board.borneOff.white = 11;

    const sources = getMovableSources(board, 'white', [3, 5]);
    expect(sources).toContain('bar');
    // Should NOT contain any point since bar must be entered first
    const pointSources = sources.filter(s => s !== 'bar');
    expect(pointSources.length).toBe(0);
  });

  it('should return points with movable checkers', () => {
    const board = createInitialBoard();
    const sources = getMovableSources(board, 'white', [3, 1]);
    expect(sources.length).toBeGreaterThan(0);
    // All sources should have white checkers
    for (const s of sources) {
      if (s !== 'bar') {
        expect(board.points[s]).toBeGreaterThan(0);
      }
    }
  });
});
