import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, MessageCircle, X } from 'lucide-react';

export default function MatchModal({ match, onClose }) {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setShow(true));
  }, []);

  const handleChat = () => {
    onClose();
    navigate(`/chat/${match.id}`);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${show ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Particles / decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full gradient-bg animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
              opacity: 0.3 + Math.random() * 0.5,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className={`relative glass rounded-3xl p-8 max-w-sm w-full mx-4 text-center transition-all duration-500 ${show ? 'scale-100 translate-y-0' : 'scale-90 translate-y-8'}`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-20 h-20 mx-auto rounded-full gradient-bg flex items-center justify-center mb-4 animate-pulse-glow">
          <Sparkles className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-3xl font-bold gradient-text mb-2">It's a Match!</h2>
        <p className="text-zinc-400 text-sm mb-6">
          You and your match share {match?.sharedKeywords?.length || 0} skills in common.
          Start chatting before time runs out! ⏰
        </p>

        {match?.sharedKeywords?.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {match.sharedKeywords.map((kw) => (
              <span
                key={kw}
                className="px-3 py-1 rounded-full text-xs font-medium bg-accent-violet/20 text-accent-violet border border-accent-violet/30"
              >
                {kw}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={handleChat}
          className="w-full gradient-bg text-white font-semibold py-3 px-6 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-5 h-5" />
          Start Chatting
        </button>
      </div>
    </div>
  );
}
