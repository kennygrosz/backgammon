import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { createGame, fetchMyGames, fetchOpenGames, joinGame, type DbGame } from '../services/gameService';

function statusLabel(game: DbGame, userId: string): string {
  if (game.status === 'waiting') return 'Waiting for opponent';
  if (game.status === 'finished') {
    const winnerColor = game.winner;
    const isWhite = game.white_player_id === userId;
    const iWon = (isWhite && winnerColor === 'white') || (!isWhite && winnerColor === 'black');
    return iWon ? 'You won!' : 'You lost';
  }
  const isWhite = game.white_player_id === userId;
  const isMyTurn =
    (isWhite && game.current_player === 'white') ||
    (!isWhite && game.current_player === 'black');
  return isMyTurn ? 'Your turn' : "Opponent's turn";
}

function opponentName(game: DbGame, userId: string): string {
  const isWhite = game.white_player_id === userId;
  if (isWhite) {
    return game.black_profile?.username ?? 'Waiting...';
  }
  return game.white_profile?.username ?? '???';
}

export default function Lobby() {
  const { user, profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [myGames, setMyGames] = useState<DbGame[]>([]);
  const [openGames, setOpenGames] = useState<DbGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadGames();
  }, [user]);

  async function loadGames() {
    if (!user) return;
    setLoading(true);
    const [my, open] = await Promise.all([
      fetchMyGames(user.id),
      fetchOpenGames(user.id),
    ]);
    setMyGames(my);
    setOpenGames(open);
    setLoading(false);
  }

  async function handleCreate() {
    if (!user) return;
    setCreating(true);
    const game = await createGame(user.id);
    setCreating(false);
    if (game) {
      navigate(`/game/${game.id}`);
    }
  }

  async function handleJoin(gameId: string) {
    if (!user) return;
    const game = await joinGame(gameId, user.id);
    if (game) {
      navigate(`/game/${game.id}`);
    }
  }

  const activeGames = myGames.filter(g => g.status !== 'finished');
  const finishedGames = myGames.filter(g => g.status === 'finished');

  return (
    <div className="flex flex-col items-center min-h-[100dvh] px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#3b2010]">Backgammon</h1>
          <p className="text-sm text-[#5c3317]">Hi, {profile?.username}</p>
        </div>
        <button
          onClick={signOut}
          className="px-3 py-1.5 text-sm rounded-lg bg-[#4a2c17]/20 text-[#4a2c17] hover:bg-[#4a2c17]/30"
        >
          Sign Out
        </button>
      </div>

      {/* New Game button */}
      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full max-w-md px-6 py-4 rounded-2xl font-bold text-lg bg-green-700 hover:bg-green-600 text-white active:scale-95 transition-all shadow-lg disabled:opacity-50 mb-6"
      >
        {creating ? 'Creating...' : 'New Game'}
      </button>

      {loading ? (
        <div className="w-8 h-8 border-4 border-[#4a2c17] border-t-transparent rounded-full animate-spin mt-8" />
      ) : (
        <div className="w-full max-w-md space-y-6">
          {/* Open games to join */}
          {openGames.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[#3b2010] mb-2">Join a Game</h2>
              <div className="space-y-2">
                {openGames.map(game => (
                  <button
                    key={game.id}
                    onClick={() => handleJoin(game.id)}
                    className="w-full flex justify-between items-center px-4 py-3 rounded-xl bg-[#4a2c17]/10 hover:bg-[#4a2c17]/20 transition-colors"
                  >
                    <span className="text-[#3b2010] font-medium">
                      vs {game.white_profile?.username ?? '???'}
                    </span>
                    <span className="text-sm text-green-700 font-semibold">Join</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Active games */}
          {activeGames.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[#3b2010] mb-2">Your Games</h2>
              <div className="space-y-2">
                {activeGames.map(game => (
                  <button
                    key={game.id}
                    onClick={() => navigate(`/game/${game.id}`)}
                    className="w-full flex justify-between items-center px-4 py-3 rounded-xl bg-[#4a2c17]/10 hover:bg-[#4a2c17]/20 transition-colors"
                  >
                    <span className="text-[#3b2010] font-medium">
                      vs {opponentName(game, user!.id)}
                    </span>
                    <span className={`text-sm font-semibold ${
                      statusLabel(game, user!.id) === 'Your turn'
                        ? 'text-green-700'
                        : 'text-[#5c3317]'
                    }`}>
                      {statusLabel(game, user!.id)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Finished games */}
          {finishedGames.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[#3b2010] mb-2">Past Games</h2>
              <div className="space-y-2">
                {finishedGames.slice(0, 5).map(game => (
                  <button
                    key={game.id}
                    onClick={() => navigate(`/game/${game.id}`)}
                    className="w-full flex justify-between items-center px-4 py-3 rounded-xl bg-[#4a2c17]/5 hover:bg-[#4a2c17]/10 transition-colors"
                  >
                    <span className="text-[#5c3317]">
                      vs {opponentName(game, user!.id)}
                    </span>
                    <span className={`text-sm font-semibold ${
                      statusLabel(game, user!.id) === 'You won!'
                        ? 'text-green-700'
                        : 'text-red-700'
                    }`}>
                      {statusLabel(game, user!.id)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeGames.length === 0 && openGames.length === 0 && finishedGames.length === 0 && (
            <p className="text-center text-[#5c3317] mt-4">
              No games yet. Create one and share the link with your sister!
            </p>
          )}

          {/* Refresh */}
          <button
            onClick={loadGames}
            className="w-full py-2 text-sm text-[#5c3317] hover:text-[#3b2010] transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
