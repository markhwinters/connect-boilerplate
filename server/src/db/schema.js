import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["candidate", "hr"]);
export const matchStatusEnum = pgEnum("match_status", [
  "pending",
  "mutual",
  "rejected",
]);

// ─── Default TTLs ─────────────────────────────────────────────────────────────

/** Session lifetime — users auto-expire after this window */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Pending match TTL */
export const PENDING_MATCH_TTL_MS = 1 * 60 * 60 * 1000; // 1 hour

/** Mutual match TTL — longer so both users have time to connect */
export const MUTUAL_MATCH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Users (ephemeral sessions) ───────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    role: userRoleEnum("role").notNull(),
    jobTitle: varchar("job_title", { length: 100 }),
    keywords: text("keywords").array().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    keywordsIdx: index("users_keywords_idx").on(table.keywords),
    roleIdx: index("users_role_idx").on(table.role),
    expiresIdx: index("users_expires_idx").on(table.expiresAt),
  }),
);

// ─── Matches (self-destructing) ───────────────────────────────────────────────

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    initiatorId: uuid("initiator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receiverId: uuid("receiver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: matchStatusEnum("status").notNull().default("pending"),
    sharedKeywords: text("shared_keywords").array().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => ({
    initiatorIdx: index("matches_initiator_idx").on(table.initiatorId),
    receiverIdx: index("matches_receiver_idx").on(table.receiverId),
    expiresIdx: index("matches_expires_idx").on(table.expiresAt),
  }),
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  initiatedMatches: many(matches, { relationName: "initiator" }),
  receivedMatches: many(matches, { relationName: "receiver" }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  initiator: one(users, {
    fields: [matches.initiatorId],
    references: [users.id],
    relationName: "initiator",
  }),
  receiver: one(users, {
    fields: [matches.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));
