import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Ghost, AlertTriangle, Paperclip, Download, FileText, CheckCircle2 } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import ChatBubble from '../components/ChatBubble';
import TypingIndicator from '../components/TypingIndicator';

export default function Chat() {
  const { matchId } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [joined, setJoined] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const { sendMessage, sendTyping, sendReadReceipt, joinRoom } = useWebSocket(user?.id, {
    'room-joined': (msg) => {
      if (msg.roomId === matchId) setJoined(true);
    },
    'chat-message': (msg) => {
      setMessages((prev) => [...prev, { ...msg, status: 'delivered' }]);
      if (document.visibilityState === 'visible') {
        sendReadReceipt(matchId, msg.ts);
      }
    },
    'typing': (msg) => {
      if (msg.from !== user?.id) {
        setIsOtherTyping(msg.isTyping);
      }
    },
    'message-read': (msg) => {
      if (msg.from !== user?.id) {
        setMessages((prev) => 
          prev.map(m => m.from === user?.id && m.ts <= msg.messageId ? { ...m, status: 'read' } : m)
        );
      }
    }
  });

  const { sendFile, transferProgress, incomingFile, setIncomingFile } = useWebRTC(matchId, user?.id, {
    onTransferStart: (fileInfo) => {
      setMessages((prev) => [
        ...prev,
        {
          type: 'file-transfer',
          from: user.id,
          payload: { ...fileInfo, status: 'sending' },
          ts: Date.now(),
          status: 'sending'
        }
      ]);
    },
    onTransferComplete: (fileInfo) => {
      setMessages((prev) => 
        prev.map(m => (m.type === 'file-transfer' && m.payload?.name === fileInfo.name && m.status === 'sending') 
          ? { ...m, status: 'delivered', payload: { ...m.payload, status: 'delivered' } } 
          : m)
      );
    },
    onFileReceived: (fileInfo) => {
      setMessages((prev) => [
        ...prev,
        {
          type: 'file-transfer',
          from: 'other',
          payload: { ...fileInfo },
          ts: Date.now(),
          status: 'delivered'
        }
      ]);
    }
  });

  // Join room on mount
  useEffect(() => {
    if (matchId && user) {
      joinRoom(matchId);
    }
  }, [matchId, user, joinRoom]);

  // Handle typing status
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (value && !input) {
      sendTyping(matchId, true);
    } else if (!value && input) {
      sendTyping(matchId, false);
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(matchId, false);
    }, 2000);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping, transferProgress, incomingFile]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    sendMessage(matchId, text);
    sendTyping(matchId, false);
    clearTimeout(typingTimeoutRef.current);

    setMessages((prev) => [
      ...prev,
      {
        type: 'chat-message',
        from: user.id,
        payload: { text },
        ts: Date.now(),
        status: 'sent'
      },
    ]);
    setInput('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      sendFile(file);
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
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

        {/* File Transfer UI */}
        {(transferProgress > 0 && transferProgress < 100) && (
          <div className="flex justify-center my-4 animate-fade-in">
            <div className="glass px-6 py-4 rounded-2xl border border-white/10 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center animate-pulse">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">Transferring File...</p>
                  <p className="text-xs text-zinc-500">{transferProgress}% complete</p>
                </div>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="gradient-bg h-full transition-all duration-300"
                  style={{ width: `${transferProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {isOtherTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={transferProgress > 0 && transferProgress < 100}
          className="p-3 rounded-xl glass glass-hover text-zinc-400 hover:text-white transition-all disabled:opacity-50"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={handleInputChange}
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
