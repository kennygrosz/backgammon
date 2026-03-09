import type { BoardState, Player, WinType } from './types.js';

export function checkWinner(board: BoardState): Player | null {
  if (board.borneOff.white === 15) return 'white';
  if (board.borneOff.black === 15) return 'black';
  return null;
}

export function getWinType(board: BoardState, winner: Player): WinType {
  const loser: Player = winner === 'white' ? 'black' : 'white';

  // Backgammon: loser has checker on the bar or in winner's home board
  if (board.borneOff[loser] === 0) {
    if (board.bar[loser] > 0) return 'backgammon';

    // Check if loser has any checkers in winner's home board
    if (winner === 'white') {
      // White's home board is indices 0-5, check if black has checkers there
      for (let i = 0; i <= 5; i++) {
        if (board.points[i] < 0) return 'backgammon';
      }
    } else {
      // Black's home board is indices 18-23, check if white has checkers there
      for (let i = 18; i <= 23; i++) {
        if (board.points[i] > 0) return 'backgammon';
      }
    }

    return 'gammon'; // Loser has borne off 0 checkers
  }

  return 'normal';
}
