export default function ChatBubble({ message, isOwn }) {
  const time = new Date(message.ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

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
        <p>{message.payload?.text}</p>
        <p className={`text-[10px] mt-1 ${isOwn ? 'text-white/50' : 'text-zinc-500'}`}>
          {time}
        </p>
      </div>
    </div>
  );
}
