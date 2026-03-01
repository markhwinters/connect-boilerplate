import { useState, useRef } from 'react';
import { Briefcase, Sparkles } from 'lucide-react';
import GlassCard from './GlassCard';
import KeywordBadge from './KeywordBadge';

export default function SwipeCard({ user, onSwipeRight, onSwipeLeft }) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exiting, setExiting] = useState(null); // 'left' | 'right' | null
  const startX = useRef(0);
  const cardRef = useRef(null);

  const handlePointerDown = (e) => {
    startX.current = e.clientX;
    setIsDragging(true);
    e.target.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    setDragX(e.clientX - startX.current);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 100;
    if (dragX > threshold) {
      setExiting('right');
      setTimeout(() => onSwipeRight?.(user), 300);
    } else if (dragX < -threshold) {
      setExiting('left');
      setTimeout(() => onSwipeLeft?.(user), 300);
    }
    setDragX(0);
  };

  const rotation = dragX * 0.1;
  const opacity = Math.max(0.5, 1 - Math.abs(dragX) / 400);

  return (
    <div
      ref={cardRef}
      className={`absolute inset-0 cursor-grab active:cursor-grabbing touch-none select-none
        ${exiting === 'right' ? 'animate-[swipe-right_0.3s_forwards]' : ''}
        ${exiting === 'left' ? 'animate-[swipe-left_0.3s_forwards]' : ''}
      `}
      style={{
        transform: exiting ? undefined : `translateX(${dragX}px) rotate(${rotation}deg)`,
        opacity: exiting ? undefined : opacity,
        transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <GlassCard className="h-full flex flex-col justify-between relative overflow-hidden">
        {/* Gradient indicator overlays */}
        {dragX > 50 && (
          <div className="absolute inset-0 bg-success/10 rounded-2xl transition-opacity z-10 pointer-events-none flex items-center justify-center">
            <span className="text-success text-5xl font-bold rotate-[-15deg]">CONNECT</span>
          </div>
        )}
        {dragX < -50 && (
          <div className="absolute inset-0 bg-danger/10 rounded-2xl transition-opacity z-10 pointer-events-none flex items-center justify-center">
            <span className="text-danger text-5xl font-bold rotate-[15deg]">SKIP</span>
          </div>
        )}

        {/* User avatar / initials */}
        <div className="flex flex-col items-center pt-8 pb-4">
          <div className="w-24 h-24 rounded-full gradient-bg flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-accent-violet/20">
            {user.displayName?.[0]?.toUpperCase() || '?'}
          </div>
          <h2 className="text-2xl font-bold text-white">{user.displayName}</h2>
          {user.jobTitle && (
            <div className="flex items-center gap-1.5 text-zinc-400 mt-1">
              <Briefcase className="w-4 h-4" />
              <span className="text-sm">{user.jobTitle}</span>
            </div>
          )}
          <div className="flex items-center gap-1 mt-2 text-accent-fuchsia text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{user.role === 'hr' ? 'Hiring' : 'Looking for work'}</span>
          </div>
        </div>

        {/* Shared keywords */}
        {user.sharedKeywords?.length > 0 && (
          <div className="px-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 text-center">Shared Skills</p>
            <div className="flex flex-wrap justify-center gap-2">
              {user.sharedKeywords.map((kw) => (
                <KeywordBadge key={kw} keyword={kw} shared />
              ))}
            </div>
          </div>
        )}

        {/* All keywords */}
        <div className="px-2 mt-4 pb-4">
          <div className="flex flex-wrap justify-center gap-1.5">
            {user.keywords?.filter((k) => !user.sharedKeywords?.includes(k)).map((kw) => (
              <KeywordBadge key={kw} keyword={kw} />
            ))}
          </div>
        </div>

        {/* Swipe hint */}
        <div className="text-center text-zinc-600 text-xs pb-3">
          ← Swipe to connect →
        </div>
      </GlassCard>
    </div>
  );
}
