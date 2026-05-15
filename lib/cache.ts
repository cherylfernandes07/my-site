import crypto from "crypto";
import { sql } from "@vercel/postgres";

const CACHE_TTL_DAYS = Number(process.env.CHAT_CACHE_TTL_DAYS ?? 30);

export interface CachedAnswer {
  answer: string;
  sourcesUsed: string[];
  hitCount: number;
}

function normalizeQuestion(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashQuestion(normalized: string): string {
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export async function getCachedAnswer(questionRaw: string): Promise<CachedAnswer | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const normalized = normalizeQuestion(questionRaw);
  if (!normalized) {
    return null;
  }

  const questionHash = hashQuestion(normalized);

  try {
    const { rows } = await sql<{
      answer: string;
      sources_used: string[];
      hit_count: number;
    }>`
      SELECT answer, sources_used, hit_count
      FROM query_cache
      WHERE question_hash = ${questionHash}
        AND expires_at > NOW()
      LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    sql`
      UPDATE query_cache
      SET hit_count = hit_count + 1,
          last_hit_at = NOW()
      WHERE question_hash = ${questionHash}
    `.catch(() => {});

    return {
      answer: rows[0].answer,
      sourcesUsed: rows[0].sources_used ?? [],
      hitCount: rows[0].hit_count ?? 0,
    };
  } catch (error) {
    console.error("Cache lookup failed:", error);
    return null;
  }
}

export async function setCachedAnswer(
  questionRaw: string,
  answer: string,
  sourcesUsed: string[]
): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const normalized = normalizeQuestion(questionRaw);
  if (!normalized || !answer.trim()) {
    return;
  }

  const questionHash = hashQuestion(normalized);

  try {
    await sql`
      INSERT INTO query_cache
        (question_hash, question_norm, answer, sources_used, expires_at)
      VALUES (
        ${questionHash},
        ${normalized},
        ${answer},
        ${sourcesUsed},
        NOW() + (${CACHE_TTL_DAYS} || ' days')::INTERVAL
      )
      ON CONFLICT (question_hash) DO UPDATE
      SET answer = EXCLUDED.answer,
          sources_used = EXCLUDED.sources_used,
          expires_at = EXCLUDED.expires_at
    `;
  } catch (error) {
    console.error("Cache write failed:", error);
  }
}
