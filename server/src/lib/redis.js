import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function createRedisClient(name) {
  const client = createClient({
    username: 'default',
    password: 'nbnwnik5TsIwPQw3gxCBpWBArJkR21P3',
    socket: {
        host: 'redis-16011.crce220.us-east-1-4.ec2.cloud.redislabs.com',
        port: 16011
    }
});


  client.on("connect", () => console.log(`[Redis:${name}] Connected`));
  client.on("error", (err) => console.error(`[Redis:${name}] Error`, err));
  client.on("close", () => console.warn(`[Redis:${name}] Connection closed`));

  return client;
}

// Separate clients required: subscriber cannot run regular commands while subscribed
export const publisher = createRedisClient("pub");
export const subscriber = createRedisClient("sub");

// Generic client for regular commands (SET, GET, etc.)
export const redis = createRedisClient("main");

// ─── Ephemeral state helpers ──────────────────────────────────────────────────

const ONLINE_PREFIX = "online:";
const ONLINE_TTL = 120; // seconds — refreshed by heartbeat / WS pong

/** Mark a user as online with auto-expiry */
export async function setOnlineUser(userId, ttl = ONLINE_TTL) {
  await redis.set(`${ONLINE_PREFIX}${userId}`, Date.now().toString(), {
    EX: ttl,
  });
}

/** Remove a user's online status immediately */
export async function removeOnlineUser(userId) {
  await redis.del(`${ONLINE_PREFIX}${userId}`);
}

/** Get all currently online user IDs */
export async function getOnlineUsers() {
  const keys = await redis.keys(`${ONLINE_PREFIX}*`);
  return keys.map((k) => k.slice(ONLINE_PREFIX.length));
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function closeRedis() {
  await Promise.all([publisher.quit(), subscriber.quit(), redis.quit()]);
}

/** Connect all Redis clients (call at startup) */
export async function connectRedis() {
  await Promise.all([publisher.connect(), subscriber.connect(), redis.connect()]);
  console.log("[Redis] All clients connected");
}
