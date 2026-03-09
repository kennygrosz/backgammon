import { describe, it, expect } from 'vitest';
import { createInitialBoard, cloneBoard, allInHomeBoard, checkerCount } from '../board';

describe('createInitialBoard', () => {
  it('should have 15 white and 15 black checkers', () => {
    const board = createInitialBoard();
    let white = 0;
    let black = 0;
    for (const val of board.points) {
      if (val > 0) white += val;
      if (val < 0) black += -val;
    }
    white += board.bar.white + board.borneOff.white;
    black += board.bar.black + board.borneOff.black;
    expect(white).toBe(15);
    expect(black).toBe(15);
  });

  it('should have correct starting positions', () => {
    const board = createInitialBoard();
    // White: 2 on point 24, 5 on point 13, 3 on point 8, 5 on point 6
    expect(board.points[23]).toBe(2);
    expect(board.points[12]).toBe(5);
    expect(board.points[7]).toBe(3);
    expect(board.points[5]).toBe(5);
    // Black: 2 on point 1, 5 on point 12, 3 on point 17, 5 on point 19
    expect(board.points[0]).toBe(-2);
    expect(board.points[11]).toBe(-5);
    expect(board.points[16]).toBe(-3);
    expect(board.points[18]).toBe(-5);
  });

  it('should have empty bar and borne off', () => {
    const board = createInitialBoard();
    expect(board.bar.white).toBe(0);
    expect(board.bar.black).toBe(0);
    expect(board.borneOff.white).toBe(0);
    expect(board.borneOff.black).toBe(0);
  });
});

describe('cloneBoard', () => {
  it('should create an independent copy', () => {
    const board = createInitialBoard();
    const clone = cloneBoard(board);
    clone.points[0] = 99;
    clone.bar.white = 5;
    expect(board.points[0]).toBe(-2);
    expect(board.bar.white).toBe(0);
  });
});

describe('allInHomeBoard', () => {
  it('should return false for initial board (both players)', () => {
    const board = createInitialBoard();
    expect(allInHomeBoard(board, 'white')).toBe(false);
    expect(allInHomeBoard(board, 'black')).toBe(false);
  });

  it('should return true when all checkers are in home board', () => {
    const board = createInitialBoard();
    board.points.fill(0);
    // Put all 15 white checkers in home board (indices 0-5)
    board.points[0] = 5;
    board.points[1] = 5;
    board.points[2] = 5;
    expect(allInHomeBoard(board, 'white')).toBe(true);
  });

  it('should return false when checker is on the bar', () => {
    const board = createInitialBoard();
    board.points.fill(0);
    board.points[0] = 5;
    board.points[1] = 5;
    board.points[2] = 4;
    board.bar.white = 1;
    expect(allInHomeBoard(board, 'white')).toBe(false);
  });
});

describe('checkerCount', () => {
  it('should return correct count for white', () => {
    const board = createInitialBoard();
    expect(checkerCount(board, 23, 'white')).toBe(2);
    expect(checkerCount(board, 23, 'black')).toBe(0);
  });

  it('should return correct count for black', () => {
    const board = createInitialBoard();
    expect(checkerCount(board, 0, 'black')).toBe(2);
    expect(checkerCount(board, 0, 'white')).toBe(0);
  });
});
