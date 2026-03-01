import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Ghost, AlertTriangle } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useWebSocket } from '../hooks/useWebSocket';
import ChatBubble from '../components/ChatBubble';

export default function Chat() {
  const { matchId } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [joined, setJoined] = useState(false);
  const messagesEndRef = useRef(null);

  const { sendMessage, joinRoom } = useWebSocket(user?.id, {
    'room-joined': (msg) => {
      if (msg.roomId === matchId) setJoined(true);
    },
    'chat-message': (msg) => {
      setMessages((prev) => [...prev, msg]);
    },
  });

  // Join room on mount
  useEffect(() => {
    if (matchId && user) {
      joinRoom(matchId);
    }
  }, [matchId, user, joinRoom]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    sendMessage(matchId, text);

    // Optimistic UI — add own message immediately
    setMessages((prev) => [
      ...prev,
      {
        type: 'chat-message',
        from: user.id,
        payload: { text },
        ts: Date.now(),
      },
    ]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] animate-fade-in">
      {/* Chat header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/discover')}
          className="p-2 rounded-xl glass glass-hover text-zinc-400 hover:text-white transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Ghost className="w-5 h-5 text-accent-fuchsia" />
            Ephemeral Chat
          </h2>
          <p className="text-zinc-500 text-xs">Room: {matchId?.slice(0, 8)}...</p>
        </div>
        {joined && (
          <span className="text-xs text-success flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Connected
          </span>
        )}
      </div>

      {/* Ephemeral warning */}
      <div className="flex items-center gap-2 bg-warning/5 border border-warning/20 rounded-xl px-4 py-2.5 mb-4 text-xs text-warning">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Messages disappear when you leave. Nothing is stored.</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Ghost className="w-12 h-12 text-zinc-700 mb-3 animate-float" />
            <p className="text-zinc-500 text-sm">No messages yet. Say hello! 👋</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatBubble
              key={i}
              message={msg}
              isOwn={msg.from === user?.id}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-accent-violet/50 focus:ring-1 focus:ring-accent-violet/30 transition-all"
          autoComplete="off"
        />
        <button
          id="send-btn"
          type="submit"
          className="px-5 rounded-xl gradient-bg text-white hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
