import { useEffect, useRef, useCallback } from 'react';
import * as ws from '../lib/ws';

/**
 * Hook to manage WebSocket connection lifecycle and message subscriptions.
 *
 * @param {string|null} userId - Auto-identifies after connecting
 * @param {Object} handlers - Map of message type → handler function
 */
export function useWebSocket(userId, handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    ws.connect(() => {
      if (userId) ws.identify(userId);
    });

    return () => {
      // Don't disconnect on unmount — keep WS alive across page navigations
    };
  }, [userId]);

  useEffect(() => {
    const unsubs = [];
    for (const [type, handler] of Object.entries(handlersRef.current)) {
      unsubs.push(ws.on(type, handler));
    }
    return () => unsubs.forEach((fn) => fn());
  }, [userId, ...Object.keys(handlers)]);

  const sendMessage = useCallback((roomId, text) => {
    ws.sendChat(roomId, text);
  }, []);

  const joinRoom = useCallback((roomId) => {
    ws.joinRoom(roomId);
  }, []);

  return { sendMessage, joinRoom, isConnected: ws.isConnected };
}
