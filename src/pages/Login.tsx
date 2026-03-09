import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const { user, needsUsername, signIn, signUp, setUsername } = useAuthStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsernameValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If logged in with a profile, redirect to game
  if (user && !needsUsername) {
    navigate('/', { replace: true });
    return null;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password);

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleSetUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setError(null);
    setSubmitting(true);

    const result = await setUsername(username.trim().toLowerCase());
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      navigate('/', { replace: true });
    }
  };

  // Username selection step (after sign-up)
  if (needsUsername) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] px-4">
        <div className="w-full max-w-sm bg-[#4a2c17]/90 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-amber-100 text-center mb-2">
            Choose a Username
          </h1>
          <p className="text-amber-200/70 text-sm text-center mb-6">
            This is how your friend will find you.
          </p>

          <form onSubmit={handleSetUsername} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsernameValue(e.target.value)}
              autoFocus
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              title="Letters, numbers, and underscores only"
              className="px-4 py-3 rounded-lg bg-[#3b2010] text-amber-100 placeholder-amber-200/40 border border-amber-900/50 focus:outline-none focus:border-amber-500"
            />

            {error && (
              <p className="text-red-300 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !username.trim()}
              className="px-6 py-3 rounded-lg font-semibold bg-green-700 hover:bg-green-600 text-white active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Sign in / Sign up form
  return (
    <div className="flex items-center justify-center min-h-[100dvh] px-4">
      <div className="w-full max-w-sm bg-[#4a2c17]/90 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold text-amber-100 text-center mb-1">
          Backgammon
        </h1>
        <p className="text-amber-200/60 text-sm text-center mb-6">
          {mode === 'signin' ? 'Sign in to play' : 'Create an account'}
        </p>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
            className="px-4 py-3 rounded-lg bg-[#3b2010] text-amber-100 placeholder-amber-200/40 border border-amber-900/50 focus:outline-none focus:border-amber-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="px-4 py-3 rounded-lg bg-[#3b2010] text-amber-100 placeholder-amber-200/40 border border-amber-900/50 focus:outline-none focus:border-amber-500"
          />

          {error && (
            <p className="text-red-300 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-lg font-semibold bg-[#5c3317] hover:bg-[#6d3d1d] text-amber-100 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? 'Loading...'
              : mode === 'signin'
                ? 'Sign In'
                : 'Sign Up'}
          </button>
        </form>

        <p className="text-amber-200/60 text-sm text-center mt-6">
          {mode === 'signin' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                onClick={() => { setMode('signup'); setError(null); }}
                className="text-amber-300 underline"
              >
                Sign Up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('signin'); setError(null); }}
                className="text-amber-300 underline"
              >
                Sign In
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
