import { FileText, Download } from 'lucide-react';

export default function ChatBubble({ message, isOwn }) {
  const time = new Date(message.ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDownload = (e) => {
    e.preventDefault();
    if (!message.payload?.url) return;

    const link = document.createElement('a');
    link.href = message.payload.url;
    link.download = message.payload.name || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          ${isOwn
            ? 'gradient-bg text-white rounded-br-md'
            : 'glass text-zinc-200 rounded-bl-md'
          }
        `}
      >
        {message.type === 'file-transfer' ? (
          <div className="flex items-center gap-3 py-1">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOwn ? 'bg-white/20' : 'bg-accent-violet/20 text-accent-violet'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{message.payload?.name}</p>
              <p className={`text-[10px] ${isOwn ? 'text-white/70' : 'text-zinc-500'}`}>
                {(message.payload?.size / 1024).toFixed(1)} KB
              </p>
            </div>
            {!isOwn && message.payload?.url && (
              <button 
                onClick={handleDownload}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white"
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <p>{message.payload?.text}</p>
        )}
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className={`text-[10px] ${isOwn ? 'text-white/50' : 'text-zinc-500'}`}>
            {time}
          </p>
          {isOwn && (
            <span className="text-[10px] text-white/50">
              {message.status === 'read' ? 'Read' : message.status === 'sending' ? 'Sending...' : 'Sent'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
