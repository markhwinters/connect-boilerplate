import "dotenv/config";
import http from "http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { router as apiRouter } from "./routes/api.js";
import { createWebSocketServer } from "./ws/server.js";
import { wsUpgradeProtection } from "./middleware/arcjet.js";
import { pool, db } from "./db/client.js";
import { users, matches } from "./db/schema.js";
import { connectRedis, closeRedis } from "./lib/redis.js";
import { lt } from "drizzle-orm";

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);
app.use(express.json({ limit: "50kb" }));

app.use("/api", apiRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer(app);

// ─── WebSocket upgrade with Arcjet protection ─────────────────────────────────

server.on("upgrade", (req, socket, head) => {
  console.log(`[Server] Upgrade request for ${req.url}`);
  // Simple check for the /ws path
  if (req.url && req.url.startsWith("/ws")) {
    console.log(`[Server] Accepting WS upgrade for ${req.url}`);
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } else {
    console.warn(`[Server] Denying WS upgrade for ${req.url}`);
    socket.destroy();
  }
});

// ─── Ephemeral cleanup ───────────────────────────────────────────────────────

/**
 * Periodically delete expired users and matches.
 * Users cascade-delete their matches, so we clean users first.
 */
async function cleanupExpired() {
  try {
    const now = new Date();

    const deletedMatches = await db
      .delete(matches)
      .where(lt(matches.expiresAt, now))
      .returning({ id: matches.id });

    const deletedUsers = await db
      .delete(users)
      .where(lt(users.expiresAt, now))
      .returning({ id: users.id });

    if (deletedUsers.length || deletedMatches.length) {
      console.log(
        `[Cleanup] Removed ${deletedUsers.length} expired users, ${deletedMatches.length} expired matches`
      );
    }
  } catch (err) {
    console.error("[Cleanup] Error during cleanup", err);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

const wss = createWebSocketServer(server);

async function start() {
  try {
    await pool.query("SELECT 1");
    console.log("[DB] PostgreSQL connected");
  } catch (err) {
    console.error("[DB] Failed to connect to PostgreSQL:", err.message);
    process.exit(1);
  }

  try {
    await connectRedis();
  } catch (err) {
    console.error("[Redis] Failed to connect:", err.message);
    if (process.env.NODE_ENV === "production") process.exit(1);
    console.warn("[Redis] Continuing without Redis in dev mode");
  }

  // Run initial cleanup, then schedule periodic cleanup
  cleanupExpired();
  const cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref(); // don't keep process alive just for cleanup

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[Server] Listening on http://127.0.0.1:${PORT}`);
    console.log(`[Server] WebSocket on ws://127.0.0.1:${PORT}/ws`);
    console.log(`[Server] Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
    console.log(`[Server] Cleanup interval: ${CLEANUP_INTERVAL_MS / 60_000}min`);
  });
}

start();

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully`);

  server.close(async () => {
    await Promise.all([pool.end(), closeRedis()]);
    console.log("[Server] Clean exit");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[Server] Forced exit after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
