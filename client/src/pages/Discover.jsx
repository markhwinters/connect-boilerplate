import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ThumbsUp, ThumbsDown, Ghost } from 'lucide-react';
import { discover, swipe } from '../lib/api';
import { useUser } from '../context/UserContext';
import { useWebSocket } from '../hooks/useWebSocket';
import SwipeCard from '../components/SwipeCard';
import MatchModal from '../components/MatchModal';

export default function Discover() {
  const { user } = useUser();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [matchResult, setMatchResult] = useState(null);

  // Listen for mutual matches via WebSocket
  useWebSocket(user?.id, {
    'mutual-match': (msg) => {
      setMatchResult(msg.match);
    },
  });

  const loadCandidates = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await discover(user.id);
      setCandidates(data.matches || []);
    } catch (err) {
      console.error('Discovery failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const handleSwipeRight = async (candidate) => {
    if (swiping) return;
    setSwiping(true);

    // Optimistically remove from list immediately
    setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));

    try {
      const result = await swipe(user.id, candidate.id);
      if (result.mutual) {
        setMatchResult(result.match);
      }
    } catch (err) {
      console.error('Swipe failed:', err);
      // In a more complex app, we might restore the card here, 
      // but for this ephemeral UX, we keep it simple.
    } finally {
      // Small delay to ensure animation finishes before allowing next swipe
      setTimeout(() => setSwiping(false), 300);
    }
  };

  const handleSwipeLeft = (candidate) => {
    if (swiping) return;
    setSwiping(true);
    
    // Optimistically remove
    setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
    
    // Non-mutual swipe-left is pure UI for this app
    setTimeout(() => setSwiping(false), 300);
  };

  const currentCard = candidates[candidates.length - 1];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-accent-fuchsia" />
            Discover
          </h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            {candidates.length} {candidates.length === 1 ? 'match' : 'matches'} found
          </p>
        </div>
        <button
          onClick={loadCandidates}
          disabled={loading}
          className="p-2 rounded-xl glass glass-hover text-zinc-400 hover:text-white transition-all disabled:opacity-30"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Card stack */}
      <div className="relative w-full h-[500px] mb-6">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-accent-violet border-t-transparent animate-spin" />
          </div>
        ) : (candidates.length === 0 && !swiping) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <Ghost className="w-16 h-16 text-zinc-700 mb-4 animate-float" />
            <h3 className="text-lg font-semibold text-zinc-400">No one around</h3>
            <p className="text-zinc-600 text-sm mt-1 max-w-xs">
              Everyone's gone ghost 👻 Try refreshing or updating your keywords.
            </p>
          </div>
        ) : (
          <>
            {/* Background cards for depth effect */}
            {candidates.slice(-3, -1).map((c, i) => (
              <div
                key={c.id}
                className="absolute inset-0 glass rounded-2xl"
                style={{
                  transform: `scale(${0.95 - i * 0.03}) translateY(${(i + 1) * 8}px)`,
                  opacity: 0.5 - i * 0.15,
                  zIndex: i,
                }}
              />
            ))}

            {/* Active swipe card */}
            {currentCard && (
              <SwipeCard
                key={currentCard.id}
                user={currentCard}
                onSwipeRight={handleSwipeRight}
                onSwipeLeft={handleSwipeLeft}
              />
            )}
          </>
        )}
      </div>

      {/* Manual swipe buttons */}
      {candidates.length > 0 && !loading && (
        <div className="flex justify-center gap-6">
          <button
            id="skip-btn"
            onClick={() => currentCard && handleSwipeLeft(currentCard)}
            className="w-14 h-14 rounded-full glass glass-hover flex items-center justify-center text-danger hover:bg-danger/10 transition-all group"
          >
            <ThumbsDown className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
          <button
            id="connect-btn"
            onClick={() => currentCard && handleSwipeRight(currentCard)}
            className="w-14 h-14 rounded-full gradient-bg flex items-center justify-center text-white hover:opacity-90 transition-all shadow-lg shadow-accent-violet/30 group"
          >
            <ThumbsUp className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      )}

      {/* Match modal */}
      {matchResult && (
        <MatchModal
          match={matchResult}
          onClose={() => setMatchResult(null)}
        />
      )}
    </div>
  );
}
