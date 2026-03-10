import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import { fetchGame } from '../services/gameService';
import type { DbGame } from '../services/gameService';
import Board from '../components/Board';
import Dice from '../components/Dice';

function playerName(player: 'white' | 'black'): string {
  return player === 'white' ? 'White' : 'Blue';
}

export default function Game() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const {
    game,
    gameId,
    myColor,
    whiteUsername,
    blackUsername,
    dbStatus,
    selectedSource,
    legalDestinations,
    movableSources,
    autoPassMessage,
    turnComplete,
    loading,
    loadGame,
    applyRemoteState,
    roll,
    selectSource,
    makeMove,
    undoLastMove,
    submitTurn,
  } = useGameStore();

  // Initial load
  useEffect(() => {
    if (id && user) {
      loadGame(id, user.id);
    }
  }, [id, user?.id]);

  // Poll for opponent updates every 3s
  useEffect(() => {
    if (!gameId) return;

    const interval = setInterval(async () => {
      const store = useGameStore.getState();
      const { game: g, myColor: mc } = store;

      // Don't poll if game is over
      if (g.status === 'finished') {
        console.log('[POLL] skipping — game finished');
        return;
      }

      // Don't overwrite while we're actively moving
      if (g.currentPlayer === mc && (g.status === 'moving' || g.turnMoves.length > 0)) {
        console.log('[POLL] skipping — actively moving');
        return;
      }

      try {
        const fresh = await fetchGame(gameId);
        if (!fresh) { console.log('[POLL] fetchGame returned null'); return; }

        const freshPlayer = fresh.current_player;
        console.log('[POLL] local:', g.currentPlayer, g.status, '| remote:', freshPlayer, fresh.status);

        // Apply if DB state differs from local
        if (freshPlayer !== g.currentPlayer || fresh.status !== (g.status as string) || fresh.status === 'finished') {
          console.log('[POLL] APPLYING remote state');
          applyRemoteState(fresh as unknown as DbGame);
        }
      } catch (err) {
        console.error('[POLL] error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [gameId]);

  if (!id) {
    navigate('/');
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="w-10 h-10 border-4 border-[#4a2c17] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!gameId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-4">
        <p className="text-[#4a2c17] text-lg">Game not found</p>
        <button onClick={() => navigate('/')} className="px-4 py-2 rounded-lg bg-[#4a2c17] text-amber-100">
          Back to Lobby
        </button>
      </div>
    );
  }

  const isMyTurn = myColor === game.currentPlayer;
  const isWaiting = dbStatus === 'waiting';
  const isFinished = game.status === 'finished';
  const isRolling = game.status === 'rolling';
  const canUndo = game.turnMoves.length > 0;

  const myUsername = myColor === 'white' ? whiteUsername : blackUsername;
  const opponentUsername = myColor === 'white' ? blackUsername : whiteUsername;

  return (
    <div className="flex flex-col items-center min-h-[100dvh] px-2 py-3">
      {/* Header */}
      <div className="w-full max-w-[780px] flex justify-between items-center mb-2">
        <button
          onClick={() => navigate('/')}
          className="px-3 py-1.5 text-sm rounded-lg bg-[#4a2c17]/20 text-[#4a2c17] hover:bg-[#4a2c17]/30"
        >
          &larr; Lobby
        </button>
        <div className="text-right">
          <span className="text-sm text-[#5c3317]">
            You ({myUsername}) vs {opponentUsername ?? '...'}
          </span>
        </div>
      </div>

      {/* Waiting state */}
      {isWaiting && (
        <div className="mb-4 px-6 py-4 rounded-xl bg-amber-100 border border-amber-300 text-[#4a2c17] text-center max-w-md">
          <p className="font-semibold mb-1">Waiting for opponent to join</p>
          <p className="text-sm mb-3">Share this link with your sister:</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={window.location.href}
              className="flex-1 px-3 py-2 rounded-lg bg-white text-sm text-[#3b2010] border border-amber-300 select-all"
              onFocus={e => e.target.select()}
            />
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="px-3 py-2 rounded-lg bg-[#4a2c17] text-amber-100 text-sm hover:bg-[#5c3317] active:scale-95"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Turn indicator */}
      {!isWaiting && (
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
                : isMyTurn
                  ? 'Your turn'
                  : `Waiting for ${opponentUsername ?? 'opponent'}...`}
          </span>
        </div>
      )}

      {/* Auto-pass message */}
      {autoPassMessage && (
        <div className="mb-2 px-4 py-2 rounded-lg bg-[#4a2c17]/20 text-[#4a2c17] text-sm text-center border border-[#4a2c17]/30">
          {autoPassMessage}
        </div>
      )}

      {/* Board with dice */}
      {!isWaiting && (
        <>
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

            {/* Dice / Roll button */}
            <div className="absolute inset-y-0 right-0 w-[15%] flex items-center justify-center pointer-events-none">
              <div className="pointer-events-auto">
                <Dice
                  dice={game.dice}
                  remainingDice={game.remainingDice}
                  onRoll={roll}
                  canRoll={isRolling && !isFinished && isMyTurn}
                />
              </div>
            </div>
          </div>

          {/* Controls below board */}
          <div className="mt-3 flex items-center gap-4">
            {canUndo && isMyTurn && (
              <button
                onClick={undoLastMove}
                className="px-6 py-3 rounded-xl font-semibold text-base bg-[#8B2500] hover:bg-[#A03000] text-amber-100 active:scale-95 transition-all shadow-md"
              >
                Undo
              </button>
            )}

            {turnComplete && isMyTurn && (
              <button
                onClick={submitTurn}
                className="px-8 py-4 rounded-2xl font-bold text-xl bg-green-700 hover:bg-green-600 text-white active:scale-95 shadow-lg transition-all"
              >
                End Turn
              </button>
            )}

            {isFinished && (
              <button
                onClick={() => navigate('/')}
                className="px-8 py-4 rounded-2xl font-bold text-xl bg-[#4a2c17] hover:bg-[#5c3317] text-amber-100 active:scale-95 shadow-lg"
              >
                Back to Lobby
              </button>
            )}
          </div>

          {/* Score display */}
          <div className="mt-3 flex gap-8 text-base text-[#5c3317]">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#F5ECD7] border border-[#D4C5A0] shadow-sm" />
              <span>{whiteUsername ?? 'White'}</span>
              <span>Off: {game.board.borneOff.white}</span>
              {game.board.bar.white > 0 && <span className="text-[#8B2500] font-semibold">Bar: {game.board.bar.white}</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#1a2e5a] border border-[#2a4070] shadow-sm" />
              <span>{blackUsername ?? 'Blue'}</span>
              <span>Off: {game.board.borneOff.black}</span>
              {game.board.bar.black > 0 && <span className="text-[#8B2500] font-semibold">Bar: {game.board.bar.black}</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
