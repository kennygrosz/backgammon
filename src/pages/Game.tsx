import { useGameStore } from '../stores/gameStore';
import Board from '../components/Board';
import Dice from '../components/Dice';

function playerName(player: 'white' | 'black'): string {
  return player === 'white' ? 'White' : 'Blue';
}

export default function Game() {
  const {
    game,
    selectedSource,
    legalDestinations,
    movableSources,
    autoPassMessage,
    turnComplete,
    roll,
    selectSource,
    makeMove,
    undoLastMove,
    submitTurn,
    newGame,
  } = useGameStore();

  const isRolling = game.status === 'rolling';
  const isFinished = game.status === 'finished';
  const canUndo = game.turnMoves.length > 0;

  return (
    <div className="flex flex-col items-center min-h-[100dvh] px-2 py-3">
      {/* Header */}
      <div className="w-full max-w-[780px] flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-[#3b2010]">Backgammon</h1>
        <button
          onClick={newGame}
          className="px-4 py-2 text-sm rounded-lg bg-[#4a2c17] hover:bg-[#5c3317] text-amber-100 active:bg-[#3a1c07]"
        >
          New Game
        </button>
      </div>

      {/* Turn indicator */}
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`w-5 h-5 rounded-full border-2 ${
            game.currentPlayer === 'white'
              ? 'bg-[#F5ECD7] border-[#D4C5A0]'
              : 'bg-[#1a2e5a] border-[#2a4070]'
          }`}
        />
        <span className="text-base font-medium text-[#4a2c17]">
          {isFinished
            ? `${playerName(game.winner!)} wins${
                game.winType === 'gammon' ? ' (Gammon!)' : game.winType === 'backgammon' ? ' (Backgammon!)' : ''
              }!`
            : turnComplete
              ? `${playerName(game.currentPlayer)} — confirm or undo`
              : `${playerName(game.currentPlayer)}'s turn`}
        </span>
      </div>

      {/* Auto-pass message */}
      {autoPassMessage && (
        <div className="mb-2 px-4 py-2 rounded-lg bg-[#4a2c17]/20 text-[#4a2c17] text-sm text-center border border-[#4a2c17]/30">
          {autoPassMessage}
        </div>
      )}

      {/* Board with dice on the right side */}
      <div className="relative w-full max-w-[780px] rounded-lg shadow-2xl overflow-hidden">
        <Board
          board={game.board}
          currentPlayer={game.currentPlayer}
          selectedSource={selectedSource}
          legalDestinations={legalDestinations}
          movableSources={movableSources}
          onSelectSource={selectSource}
          onSelectDestination={makeMove}
        />

        {/* Dice / Roll button — positioned on the right side near bear-off */}
        <div className="absolute inset-y-0 right-0 w-[15%] flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <Dice
              dice={game.dice}
              remainingDice={game.remainingDice}
              onRoll={roll}
              canRoll={isRolling && !isFinished}
            />
          </div>
        </div>
      </div>

      {/* Controls below board */}
      <div className="mt-3 flex items-center gap-4">
        {canUndo && (
          <button
            onClick={undoLastMove}
            className="px-6 py-3 rounded-xl font-semibold text-base bg-[#8B2500] hover:bg-[#A03000] text-amber-100 active:scale-95 transition-all shadow-md"
          >
            Undo
          </button>
        )}

        {turnComplete && (
          <button
            onClick={submitTurn}
            className="px-8 py-4 rounded-2xl font-bold text-xl bg-green-700 hover:bg-green-600 text-white active:scale-95 shadow-lg transition-all"
          >
            End Turn
          </button>
        )}

        {isFinished && (
          <button
            onClick={newGame}
            className="px-8 py-4 rounded-2xl font-bold text-xl bg-[#4a2c17] hover:bg-[#5c3317] text-amber-100 active:scale-95 shadow-lg"
          >
            Play Again
          </button>
        )}
      </div>

      {/* Score display */}
      <div className="mt-3 flex gap-8 text-base text-[#5c3317]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#F5ECD7] border border-[#D4C5A0] shadow-sm" />
          <span>Off: {game.board.borneOff.white}</span>
          {game.board.bar.white > 0 && <span className="text-[#8B2500] font-semibold">Bar: {game.board.bar.white}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#1a2e5a] border border-[#2a4070] shadow-sm" />
          <span>Off: {game.board.borneOff.black}</span>
          {game.board.bar.black > 0 && <span className="text-[#8B2500] font-semibold">Bar: {game.board.bar.black}</span>}
        </div>
      </div>
    </div>
  );
}
