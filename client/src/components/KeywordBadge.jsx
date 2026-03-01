export default function KeywordBadge({ keyword, shared = false, onRemove }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
        ${shared
          ? 'bg-accent-violet/20 text-accent-violet border border-accent-violet/30'
          : 'bg-white/5 text-zinc-300 border border-white/10'
        }
      `}
    >
      {shared && (
        <span className="w-1.5 h-1.5 rounded-full bg-accent-violet animate-pulse-glow" />
      )}
      {keyword}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(keyword); }}
          className="ml-1 text-zinc-400 hover:text-white transition-colors"
        >
          ×
        </button>
      )}
    </span>
  );
}
