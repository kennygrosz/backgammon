import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Game from './pages/Game';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, needsUsername } = useAuthStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="w-10 h-10 border-4 border-[#4a2c17] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || needsUsername) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <AuthGate>
              <Game />
            </AuthGate>
          }
        />
        <Route
          path="/game/:id"
          element={
            <AuthGate>
              <Game />
            </AuthGate>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
