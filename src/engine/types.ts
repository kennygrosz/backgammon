export type Player = 'white' | 'black';

export type BoardState = {
  // 24 points. Index 0 = point 1 (white's home board).
  // Positive values = white checkers, negative = black checkers.
  points: number[];
  bar: { white: number; black: number };
  borneOff: { white: number; black: number };
};

export type DiceRoll = [number, number];

export type Move = {
  from: number | 'bar'; // point index (0-23) or 'bar'
  to: number | 'off';   // point index (0-23) or 'off' (bear off)
  dieUsed: number;       // which die value was consumed
  hit: boolean;          // whether opponent checker was sent to bar
};

export type GameStatus = 'rolling' | 'moving' | 'finished';

export type WinType = 'normal' | 'gammon' | 'backgammon';

export type GameState = {
  board: BoardState;
  currentPlayer: Player;
  dice: DiceRoll | null;
  remainingDice: number[];
  turnMoves: Move[];              // moves made so far this turn (for undo)
  boardSnapshots: BoardState[];   // board state before each move (for per-move undo)
  status: GameStatus;
  winner: Player | null;
  winType: WinType | null;
};
