import type { DiceRoll } from '../engine/types';

interface DiceProps {
  dice: DiceRoll | null;
  remainingDice: number[];
  onRoll: () => void;
  canRoll: boolean;
}

const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function DieFace({ value, used }: { value: number; used: boolean }) {
  const dots = DOT_POSITIONS[value] || [];

  return (
    <div
      className={`relative w-12 h-12 rounded-lg transition-opacity ${
        used ? 'opacity-30' : ''
      } bg-amber-100 shadow-lg border-2 border-amber-300`}
    >
      {dots.map(([x, y], i) => (
        <div
          key={i}
          className="absolute w-2.5 h-2.5 rounded-full bg-gray-900"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}

// Determine if the die at this index has been used
function isUsed(allDice: number[], remaining: number[], index: number): boolean {
  const value = allDice[index];
  const countUpToIndex = allDice.filter((d, i) => i <= index && d === value).length;
  const countRemaining = remaining.filter(d => d === value).length;
  return countUpToIndex > countRemaining;
}

export default function Dice({ dice, remainingDice, onRoll, canRoll }: DiceProps) {
  if (!dice) {
    return (
      <button
        onClick={onRoll}
        disabled={!canRoll}
        className={`px-10 py-8 rounded-2xl font-bold text-2xl transition-all ${
          canRoll
            ? 'bg-amber-600 hover:bg-amber-500 text-white active:scale-95 active:bg-amber-700 shadow-lg'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        Roll
      </button>
    );
  }

  const isDoubles = dice[0] === dice[1];
  const diceValues = isDoubles ? [dice[0], dice[0], dice[0], dice[0]] : [dice[0], dice[1]];

  return (
    <div className="flex flex-col gap-2 items-center">
      {diceValues.map((val, i) => (
        <DieFace key={i} value={val} used={isUsed(diceValues, remainingDice, i)} />
      ))}
    </div>
  );
}
