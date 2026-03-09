import { describe, it, expect } from 'vitest';
import { checkWinner, getWinType } from '../rules';
import type { BoardState } from '../types';

function emptyBoard(): BoardState {
  return {
    points: new Array(24).fill(0),
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 },
  };
}

describe('checkWinner', () => {
  it('should return null when no winner', () => {
    const board = emptyBoard();
    board.borneOff.white = 10;
    board.borneOff.black = 5;
    expect(checkWinner(board)).toBeNull();
  });

  it('should return white when white bears off all 15', () => {
    const board = emptyBoard();
    board.borneOff.white = 15;
    expect(checkWinner(board)).toBe('white');
  });

  it('should return black when black bears off all 15', () => {
    const board = emptyBoard();
    board.borneOff.black = 15;
    expect(checkWinner(board)).toBe('black');
  });
});

describe('getWinType', () => {
  it('should return normal when loser has borne off checkers', () => {
    const board = emptyBoard();
    board.borneOff.white = 15;
    board.borneOff.black = 3;
    expect(getWinType(board, 'white')).toBe('normal');
  });

  it('should return gammon when loser has 0 borne off', () => {
    const board = emptyBoard();
    board.borneOff.white = 15;
    board.points[20] = -15; // all black still on board
    expect(getWinType(board, 'white')).toBe('gammon');
  });

  it('should return backgammon when loser has checker on bar', () => {
    const board = emptyBoard();
    board.borneOff.white = 15;
    board.points[20] = -14;
    board.bar.black = 1;
    expect(getWinType(board, 'white')).toBe('backgammon');
  });

  it('should return backgammon when loser has checker in winner home board', () => {
    const board = emptyBoard();
    board.borneOff.white = 15;
    board.points[20] = -14;
    board.points[3] = -1; // black checker in white's home board (indices 0-5)
    expect(getWinType(board, 'white')).toBe('backgammon');
  });
});
