import { Router } from "express";
import { db } from "../db/client.js";
import { users, matches, SESSION_TTL_MS, PENDING_MATCH_TTL_MS, MUTUAL_MATCH_TTL_MS } from "../db/schema.js";
import { eq, or, and, gt } from "drizzle-orm";
import { findMatchesByKeywords } from "../lib/matching.js";
import {
  arcjetMiddleware,
  swipeProtection,
  profileUpdateProtection,
} from "../middleware/arcjet.js";
import { sendToUser } from "../ws/server.js";

export const router = Router();

// ─── Health ───────────────────────────────────────────────────────────────────

router.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// ─── Ephemeral Sessions ───────────────────────────────────────────────────────

/**
 * POST /api/users
 * Join a session — creates a temporary user that auto-expires.
 */
router.post("/users", arcjetMiddleware(profileUpdateProtection), async (req, res) => {
  try {
    const { email, displayName, role, jobTitle, keywords = [] } = req.body;

    if (!email || !displayName || !role) {
      return res.status(400).json({ error: "email, displayName, and role are required" });
    }

    if (!["candidate", "hr"].includes(role)) {
      return res.status(400).json({ error: "role must be candidate or hr" });
    }

    if (keywords.length > 10) {
      return res.status(400).json({ error: "Maximum 10 keywords allowed" });
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    // Check if user already exists and session is active
    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), gt(users.expiresAt, new Date())));

    if (existingUser) {
      console.log(`[POST /users] Resuming session for: ${email}`);
      const [updated] = await db
        .update(users)
        .set({ displayName, role, jobTitle, keywords, expiresAt })
        .where(eq(users.id, existingUser.id))
        .returning();
      return res.status(200).json(updated);
    }

    const [user] = await db
      .insert(users)
      .values({ email, displayName, role, jobTitle, keywords, expiresAt })
      .returning();

    res.status(201).json(user);
  } catch (err) {
    if (err.code === "23505") {
      // This should ideally not happen now with the check above, but keep for safety
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error("[POST /users]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/users/:id
 * Fetch a user — only if their session hasn't expired.
 */
router.get("/users/:id", async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, req.params.id), gt(users.expiresAt, new Date())));

    if (!user) return res.status(404).json({ error: "User not found or session expired" });
    res.json(user);
  } catch (err) {
    console.error("[GET /users/:id]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/users/:id
 * Update session — keywords, jobTitle, displayName. Also refreshes TTL.
 */
router.patch(
  "/users/:id",
  arcjetMiddleware(profileUpdateProtection),
  async (req, res) => {
    try {
      const { keywords, jobTitle, displayName } = req.body;
      const updates = {};

      if (keywords !== undefined) {
        if (!Array.isArray(keywords) || keywords.length > 10) {
          return res.status(400).json({ error: "keywords must be an array of max 10 strings" });
        }
        updates.keywords = keywords;
      }
      if (jobTitle !== undefined) updates.jobTitle = jobTitle;
      if (displayName !== undefined) updates.displayName = displayName;

      // Always refresh the session TTL on update
      updates.expiresAt = new Date(Date.now() + SESSION_TTL_MS);

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(and(eq(users.id, req.params.id), gt(users.expiresAt, new Date())))
        .returning();

      if (!updated) return res.status(404).json({ error: "User not found or session expired" });
      res.json(updated);
    } catch (err) {
      console.error("[PATCH /users/:id]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * DELETE /api/users/:id
 * Self-destruct — immediately removes user + cascades to matches.
 */
router.delete("/users/:id", async (req, res) => {
  try {
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, req.params.id))
      .returning({ id: users.id });

    if (!deleted) return res.status(404).json({ error: "User not found" });
    res.json({ deleted: true, id: deleted.id });
  } catch (err) {
    console.error("[DELETE /users/:id]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/heartbeat/:userId
 * Keep session alive — extends expiresAt by another SESSION_TTL.
 */
router.post("/heartbeat/:userId", async (req, res) => {
  try {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const [refreshed] = await db
      .update(users)
      .set({ expiresAt })
      .where(and(eq(users.id, req.params.userId), gt(users.expiresAt, new Date())))
      .returning({ id: users.id, expiresAt: users.expiresAt });

    if (!refreshed) return res.status(404).json({ error: "User not found or session expired" });
    res.json(refreshed);
  } catch (err) {
    console.error("[POST /heartbeat]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * GET /api/discover/:userId
 * Find users with overlapping keywords (only non-expired sessions).
 */
router.get("/discover/:userId", async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, req.params.userId), gt(users.expiresAt, new Date())));

    if (!user) return res.status(404).json({ error: "User not found or session expired" });

    const targetRole = user.role === "hr" ? "candidate" : "hr";
    const candidates = await findMatchesByKeywords(user.keywords, user.id, targetRole);

    res.json({ matches: candidates, count: candidates.length });
  } catch (err) {
    console.error("[GET /discover]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Swipe (ephemeral) ────────────────────────────────────────────────────────

/**
 * POST /api/swipe
 * Express interest. Matches auto-expire.
 * If both parties have swiped, creates a mutual match + WS notification.
 */
router.post("/swipe", arcjetMiddleware(swipeProtection), async (req, res) => {
  try {
    const { initiatorId, receiverId } = req.body;
    console.log(`[POST /swipe] Initiator: ${initiatorId}, Receiver: ${receiverId}`);

    if (!initiatorId || !receiverId) {
      return res.status(400).json({ error: "initiatorId and receiverId required" });
    }

    // Check if receiver already swiped on initiator → mutual match
    const existingMatch = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.initiatorId, receiverId),
          eq(matches.receiverId, initiatorId),
          gt(matches.expiresAt, new Date())
        )
      ).then(r => r[0]);

    if (existingMatch) {
      console.log(`[POST /swipe] Mutual match found! Match ID: ${existingMatch.id}`);
      const expiresAt = new Date(Date.now() + MUTUAL_MATCH_TTL_MS);

      const [mutualMatch] = await db
        .update(matches)
        .set({ status: "mutual", expiresAt })
        .where(eq(matches.id, existingMatch.id))
        .returning();

      // Notify both parties via WebSocket
      const matchNotification = {
        type: "mutual-match",
        match: mutualMatch,
      };
      const n1 = sendToUser(initiatorId, matchNotification);
      const n2 = sendToUser(receiverId, matchNotification);
      console.log(`[POST /swipe] WS Notifications sent: Initiator=${n1}, Receiver=${n2}`);

      return res.json({ match: mutualMatch, mutual: true });
    }

    console.log(`[POST /swipe] Match is pending (not mutual yet)`);

    // Check for duplicate swipe
    const [duplicate] = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.initiatorId, initiatorId),
          eq(matches.receiverId, receiverId),
          gt(matches.expiresAt, new Date())
        )
      );

    if (duplicate) {
      return res.status(409).json({ error: "Already swiped on this user" });
    }

    // Compute shared keywords
    const [initiator, receiver] = await Promise.all([
      db.select().from(users).where(eq(users.id, initiatorId)).then((r) => r[0]),
      db.select().from(users).where(eq(users.id, receiverId)).then((r) => r[0]),
    ]);

    if (!initiator || !receiver) {
      return res.status(404).json({ error: "User not found" });
    }

    const sharedKeywords = initiator.keywords.filter((k) =>
      receiver.keywords.includes(k)
    );

    const expiresAt = new Date(Date.now() + PENDING_MATCH_TTL_MS);

    const [newMatch] = await db
      .insert(matches)
      .values({ initiatorId, receiverId, sharedKeywords, expiresAt })
      .returning();

    res.status(201).json({ match: newMatch, mutual: false });
  } catch (err) {
    console.error("[POST /swipe]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
