import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import {
  subscriber,
  publisher,
  setOnlineUser,
  removeOnlineUser,
} from "../lib/redis.js";

const HEARTBEAT_INTERVAL_MS = 30_000;
const REDIS_CHANNEL = "connect-talent:ws";

// ─── In-memory state ─────────────────────────────────────────────────────────

/** @type {Map<string, WebSocket>} socketId → ws */
const clients = new Map();

/** @type {Map<string, Set<string>>} roomId → Set<socketId> */
const rooms = new Map();

/** @type {Map<string, string>} socketId → userId */
const socketUserMap = new Map();

/** @type {Map<string, string>} userId → socketId (reverse lookup for push notifications) */
const userSocketMap = new Map();

// ─── Redis backplane ──────────────────────────────────────────────────────────

async function initRedisSubscription() {
  await subscriber.subscribe(REDIS_CHANNEL);
  console.log(`[WS] Subscribed to Redis channel: ${REDIS_CHANNEL}`);
}

subscriber.on("message", (_channel, raw) => {
  try {
    const { roomId, senderId, payload } = JSON.parse(raw);
    broadcastToRoom(roomId, payload, senderId, false);
  } catch (err) {
    console.error("[WS] Failed to parse Redis message", err);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/**
 * Send a message directly to a specific user by userId.
 * Used for push notifications (e.g., mutual match alerts).
 */
export function sendToUser(userId, payload) {
  const socketId = userSocketMap.get(userId);
  if (!socketId) return false;
  const ws = clients.get(socketId);
  if (ws) {
    send(ws, payload);
    return true;
  }
  return false;
}

function broadcastToRoom(
  roomId,
  payload,
  excludeSocketId = null,
  publish = true,
) {
  const room = rooms.get(roomId);
  if (!room) return;

  for (const socketId of room) {
    if (socketId === excludeSocketId) continue;
    const ws = clients.get(socketId);
    if (ws) send(ws, payload);
  }

  if (publish) {
    publisher.publish(
      REDIS_CHANNEL,
      JSON.stringify({ roomId, senderId: excludeSocketId, payload }),
    );
  }
}

function joinRoom(socketId, roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(socketId);
  console.log(`[WS] Socket ${socketId} joined room ${roomId}`);
}

function leaveAllRooms(socketId) {
  for (const [roomId, members] of rooms) {
    members.delete(socketId);
    if (members.size === 0) rooms.delete(roomId);
  }
}

// ─── Message handlers ─────────────────────────────────────────────────────────

function handleMessage(socketId, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    console.warn("[WS] Non-JSON message from", socketId);
    return;
  }

  const { type, roomId, userId, payload } = msg;

  switch (type) {
    case "identify": {
      socketUserMap.set(socketId, userId);
      userSocketMap.set(userId, socketId);
      // Mark user online in Redis with TTL
      setOnlineUser(userId).catch((err) =>
        console.error("[WS] Failed to set online status", err),
      );
      console.log(`[WS] Socket ${socketId} identified as user ${userId}`);
      break;
    }

    case "join-room": {
      if (!roomId) return;
      joinRoom(socketId, roomId);
      send(clients.get(socketId), { type: "room-joined", roomId });
      break;
    }

    case "webrtc-offer":
    case "webrtc-answer":
    case "webrtc-ice-candidate": {
      if (!roomId) return;
      broadcastToRoom(roomId, { type, payload, from: socketUserMap.get(socketId) }, socketId);
      break;
    }

    // Ephemeral chat — relay only, never stored
    case "chat-message": {
      if (!roomId) return;
      broadcastToRoom(
        roomId,
        {
          type: "chat-message",
          from: socketUserMap.get(socketId),
          payload,
          ts: Date.now(),
        },
        socketId,
      );
      break;
    }

    case "typing": {
      if (!roomId) return;
      broadcastToRoom(
        roomId,
        {
          type: "typing",
          roomId,
          from: socketUserMap.get(socketId),
          isTyping: payload.isTyping,
        },
        socketId,
      );
      break;
    }

    case "message-read": {
      if (!roomId) return;
      broadcastToRoom(
        roomId,
        {
          type: "message-read",
          roomId,
          from: socketUserMap.get(socketId),
          messageId: payload.messageId,
        },
        socketId,
      );
      break;
    }

    default:
      console.warn(`[WS] Unknown message type: ${type}`);
  }
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

function setupHeartbeat(wss) {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        console.log("[WS] Terminating zombie connection");
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on("close", () => clearInterval(interval));
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function createWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  setupHeartbeat(wss);
  initRedisSubscription().catch((err) =>
    console.error("[WS] Redis subscription failed", err),
  );

  wss.on("connection", (ws, req) => {
    const socketId = uuidv4();
    ws.isAlive = true;
    clients.set(socketId, ws);

    console.log(
      `[WS] New connection: ${socketId} from ${req.socket.remoteAddress}`,
    );
    send(ws, { type: "connected", socketId });

    ws.on("pong", () => {
      ws.isAlive = true;
      // Refresh online status on each pong
      const userId = socketUserMap.get(socketId);
      if (userId) {
        setOnlineUser(userId).catch(() => {});
      }
    });

    ws.on("message", (data) => {
      handleMessage(socketId, data.toString());
    });

    ws.on("close", (code, reason) => {
      console.log(`[WS] Socket ${socketId} closed: ${code} ${reason}`);
      const userId = socketUserMap.get(socketId);
      clients.delete(socketId);
      socketUserMap.delete(socketId);
      if (userId) {
        userSocketMap.delete(userId);
        removeOnlineUser(userId).catch(() => {});
      }
      leaveAllRooms(socketId);
    });

    ws.on("error", (err) => {
      console.error(`[WS] Socket ${socketId} error`, err);
    });
  });

  wss.on("error", (err) => {
    console.error("[WS] Server error", err);
  });

  console.log("[WS] WebSocket server ready on /ws");
  return wss;
}
