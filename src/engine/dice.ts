import type { DiceRoll } from './types.js';

export function rollDice(): DiceRoll {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return [d1, d2];
}

// Get the list of available dice values from a roll
// Doubles give 4 moves
export function diceToValues(dice: DiceRoll): number[] {
  if (dice[0] === dice[1]) {
    return [dice[0], dice[0], dice[0], dice[0]];
  }
  return [dice[0], dice[1]];
}
