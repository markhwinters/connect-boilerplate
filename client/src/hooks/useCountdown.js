import { useState, useEffect, useRef } from 'react';

/**
 * Countdown hook — returns remaining time until a target date.
 * Updates every second.
 *
 * @param {string|Date} expiresAt - ISO timestamp or Date
 * @returns {{ hours, minutes, seconds, isExpired, totalSeconds, label }}
 */
export function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(() => calcRemaining(expiresAt));
  const intervalRef = useRef(null);

  useEffect(() => {
    setRemaining(calcRemaining(expiresAt));
    intervalRef.current = setInterval(() => {
      setRemaining(calcRemaining(expiresAt));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [expiresAt]);

  return remaining;
}

function calcRemaining(expiresAt) {
  if (!expiresAt) return { hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0, label: 'Expired' };

  const diff = new Date(expiresAt).getTime() - Date.now();

  if (diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0, label: 'Expired' };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return { hours, minutes, seconds, isExpired: false, totalSeconds, label: parts.join(' ') };
}
