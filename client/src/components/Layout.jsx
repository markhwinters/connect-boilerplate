import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { Compass, User, Ghost, Zap } from 'lucide-react';
import { useUser } from '../context/UserContext';
import CountdownBadge from './CountdownBadge';

export default function Layout() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-accent-violet border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Top bar */}
      <header className="glass border-b border-white/5 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ghost className="w-6 h-6 text-accent-fuchsia" />
            <h1 className="text-lg font-bold gradient-text">Connect</h1>
          </div>
          <CountdownBadge expiresAt={user.expiresAt} />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="glass border-t border-white/5 sticky bottom-0 z-40">
        <div className="max-w-2xl mx-auto flex">
          <NavButton to="/discover" icon={Compass} label="Discover" />
          <NavButton to="/profile" icon={User} label="Profile" />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-all duration-200
        ${isActive
          ? 'text-accent-fuchsia'
          : 'text-zinc-500 hover:text-zinc-300'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="w-5 h-5" />
          <span>{label}</span>
          {isActive && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 gradient-bg rounded-full" />
          )}
        </>
      )}
    </NavLink>
  );
}
