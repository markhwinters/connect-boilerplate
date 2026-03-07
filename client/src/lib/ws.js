/**
 * WebSocket client singleton.
 * Handles connection, reconnection, and message routing.
 */

let ws = null;
let listeners = new Map();
let reconnectTimeout = null;
const RECONNECT_DELAY = 3000;

function getWsUrl() {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export function connect(onOpen) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    onOpen?.();
    return;
  }

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    console.log('[WS] Connected');
    onOpen?.();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const handlers = listeners.get(msg.type);
      if (handlers) {
        handlers.forEach((fn) => fn(msg));
      }
    } catch (err) {
      console.warn('[WS] Failed to parse message', err);
    }
  };

  ws.onclose = (event) => {
    console.log('[WS] Disconnected:', event.code);
    ws = null;
    // Auto-reconnect unless intentionally closed
    if (event.code !== 1000) {
      reconnectTimeout = setTimeout(() => connect(onOpen), RECONNECT_DELAY);
    }
  };

  ws.onerror = (err) => {
    console.error('[WS] Error', err);
  };
}

export function disconnect() {
  clearTimeout(reconnectTimeout);
  if (ws) {
    ws.close(1000, 'client disconnect');
    ws = null;
  }
}

export function send(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function identify(userId) {
  send({ type: 'identify', userId });
}

export function joinRoom(roomId) {
  send({ type: 'join-room', roomId });
}

export function sendChat(roomId, text) {
  send({ type: 'chat-message', roomId, payload: { text } });
}

export function sendTyping(roomId, isTyping) {
  send({ type: 'typing', roomId, payload: { isTyping } });
}

export function sendReadReceipt(roomId, messageId) {
  send({ type: 'message-read', roomId, payload: { messageId } });
}

export function sendWebRTCOffer(roomId, payload) {
  send({ type: 'webrtc-offer', roomId, payload });
}

export function sendWebRTCAnswer(roomId, payload) {
  send({ type: 'webrtc-answer', roomId, payload });
}

export function sendICECandidate(roomId, payload) {
  send({ type: 'webrtc-ice-candidate', roomId, payload });
}

/** Subscribe to a message type. Returns an unsubscribe function. */
export function on(type, handler) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(handler);
  return () => listeners.get(type)?.delete(handler);
}

export function isConnected() {
  return ws && ws.readyState === WebSocket.OPEN;
}
