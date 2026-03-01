import { Timer, AlertTriangle } from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown';

export default function CountdownBadge({ expiresAt, className = '' }) {
  const { label, isExpired, totalSeconds } = useCountdown(expiresAt);

  const isUrgent = totalSeconds < 3600; // less than 1 hour

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300
        ${isExpired
          ? 'bg-danger/20 text-danger border border-danger/30'
          : isUrgent
            ? 'bg-warning/20 text-warning border border-warning/30 animate-pulse-glow'
            : 'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20'
        }
        ${className}
      `}
    >
      {isUrgent && !isExpired ? (
        <AlertTriangle className="w-3 h-3" />
      ) : (
        <Timer className="w-3 h-3" />
      )}
      {isExpired ? 'Expired' : label}
    </span>
  );
}
