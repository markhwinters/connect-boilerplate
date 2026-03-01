import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { sql, and, eq, ne, gt, arrayOverlaps } from "drizzle-orm";

/**
 * Find non-expired users whose keywords intersect with the given array.
 * Uses PostgreSQL array overlap operator (&&) via Drizzle's arrayOverlaps.
 *
 * @param {string[]} keywords - caller's keywords
 * @param {string} excludeUserId - don't return the caller
 * @param {"candidate"|"hr"} targetRole - filter by opposite role
 * @returns {Promise<Array>}
 */
export async function findMatchesByKeywords(keywords, excludeUserId, targetRole) {
  // Guard clause: if no keywords, no matches possible
  if (!keywords || keywords.length === 0) return [];

  const results = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      jobTitle: users.jobTitle,
      keywords: users.keywords,
      role: users.role,
    })
    .from(users)
    .where(
      and(
        // 1. Match the specific role (e.g., HR looks for Candidates)
        eq(users.role, targetRole),
        
        // 2. Exclude the current user from results
        ne(users.id, excludeUserId),
        
        // 3. Only show users who haven't expired
        gt(users.expiresAt, sql`NOW()`),
        
        // 4. The "Overlap" check (&&) - matches if any keyword exists in both arrays
        arrayOverlaps(users.keywords, keywords)
      )
    )
    .limit(50);

  // Return the users and calculate which specific keywords they shared
  return results.map((user) => ({
    ...user,
    sharedKeywords: user.keywords.filter((k) => keywords.includes(k)),
  }));
}