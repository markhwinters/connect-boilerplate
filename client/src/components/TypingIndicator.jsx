export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2 text-zinc-500 animate-fade-in">
      <div className="flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" />
      </div>
      <span className="text-xs ml-2 font-medium">Someone is typing...</span>
    </div>
  );
}
