// lib/db.ts
// Neon DB client + retrieval and cache helpers.
// Used by app/api/chat/route.ts — never import heavy deps here.

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

// ─────────────────────────────────────────
// Client
// ─────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL environment variable');
}

export const sql = neon(process.env.DATABASE_URL);

// Cache TTL in days — override via CHAT_CACHE_TTL_DAYS in Vercel env vars
const CACHE_TTL_DAYS = Number(process.env.CHAT_CACHE_TTL_DAYS ?? 7);


// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
export interface ContentSection {
  id: string;
  source_slug: string;
  section_key: string;
  title: string;
  content: string;
  keywords: string[];
}

export interface CacheEntry {
  answer: string;
  sources_used: string[];
  hit_count: number;
}


// ─────────────────────────────────────────
// Question normalization + hashing
// Normalize before hashing so "What are your skills?"
// and "what are your skills" hit the same cache row.
// ─────────────────────────────────────────
export function normalizeQuestion(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\w\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')      // collapse whitespace
    .trim();
}

export function hashQuestion(normalized: string): string {
  return crypto.createHash('sha256').update(normalized).digest('hex');
}


// ─────────────────────────────────────────
// Cache: read
// Returns null on miss or if the entry is expired.
// ─────────────────────────────────────────
export async function getCachedAnswer(
  questionRaw: string
): Promise<CacheEntry | null> {
  const hash = hashQuestion(normalizeQuestion(questionRaw));

  const rows = await sql`
    SELECT answer, sources_used, hit_count
    FROM   query_cache
    WHERE  question_hash = ${hash}
      AND  expires_at > NOW()
    LIMIT  1
  `;

  if (rows.length === 0) return null;

  // Fire-and-forget hit bump (non-blocking)
  sql`SELECT touch_cache_hit(${hash})`.catch(() => {});

  return rows[0] as CacheEntry;
}


// ─────────────────────────────────────────
// Cache: write
// Call this after streaming a Gemini response to completion.
// ─────────────────────────────────────────
export async function setCachedAnswer(
  questionRaw: string,
  answer: string,
  sourcesUsed: string[]
): Promise<void> {
  const norm = normalizeQuestion(questionRaw);
  const hash = hashQuestion(norm);

  await sql`
    INSERT INTO query_cache
      (question_hash, question_norm, answer, sources_used, expires_at)
    VALUES (
      ${hash},
      ${norm},
      ${answer},
      ${sourcesUsed},
      NOW() + (${CACHE_TTL_DAYS} || ' days')::INTERVAL
    )
    ON CONFLICT (question_hash) DO UPDATE SET
      answer       = EXCLUDED.answer,
      sources_used = EXCLUDED.sources_used,
      expires_at   = EXCLUDED.expires_at,
      hit_count    = query_cache.hit_count + 1,
      last_hit_at  = NOW()
  `;
}


// ─────────────────────────────────────────
// Retrieval: keyword + full-text search
// Returns the top N most relevant sections across all sources
// (or filtered to specific source slugs if provided).
// No embeddings — pure Postgres.
// ─────────────────────────────────────────
export async function retrieveSections(
  query: string,
  options: {
    sources?: string[];   // e.g. ['xml', 'linkedin'] — omit for all
    limit?: number;
  } = {}
): Promise<ContentSection[]> {
  const { sources, limit = 6 } = options;

  // Build keyword array from the query (simple split + dedupe)
  const keywords = [...new Set(
    query.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2)
  )];

  // Full-text search vector from the query
  const tsQuery = keywords.join(' | ');  // OR across all terms

  const rows = await sql`
    SELECT
      cs.id,
      s.slug  AS source_slug,
      cs.section_key,
      cs.title,
      cs.content,
      cs.keywords,
      -- Score: FTS rank + keyword overlap bonus
      (
        ts_rank(
          to_tsvector('english', cs.title || ' ' || cs.content),
          to_tsquery('english', ${tsQuery})
        )
        + (
          SELECT COUNT(*)::FLOAT / GREATEST(array_length(cs.keywords, 1), 1)
          FROM   unnest(${keywords}::TEXT[]) kw
          WHERE  kw = ANY(cs.keywords)
        ) * 0.5
      ) AS score
    FROM   content_sections cs
    JOIN   sources s ON s.id = cs.source_id
    WHERE  (
      to_tsvector('english', cs.title || ' ' || cs.content)
        @@ to_tsquery('english', ${tsQuery})
      OR cs.keywords && ${keywords}::TEXT[]
    )
    AND (
      ${sources ?? null} IS NULL
      OR s.slug = ANY(${sources ?? []}::TEXT[])
    )
    ORDER  BY score DESC
    LIMIT  ${limit}
  `;

  return rows as ContentSection[];
}


// ─────────────────────────────────────────
// Retrieval: fetch all sections for a source
// Used by seed scripts and the ingest pipeline.
// ─────────────────────────────────────────
export async function getSectionsBySource(sourceSlug: string): Promise<ContentSection[]> {
  const rows = await sql`
    SELECT
      cs.id,
      s.slug  AS source_slug,
      cs.section_key,
      cs.title,
      cs.content,
      cs.keywords
    FROM content_sections cs
    JOIN sources s ON s.id = cs.source_id
    WHERE s.slug = ${sourceSlug}
    ORDER BY cs.section_key
  `;
  return rows as ContentSection[];
}


// ─────────────────────────────────────────
// Upsert helper used by all seed scripts
// ─────────────────────────────────────────
export async function upsertSection(
  sourceSlug: string,
  section_key: string,
  title: string,
  content: string,
  keywords: string[]
): Promise<void> {
  await sql`
    INSERT INTO content_sections
      (source_id, section_key, title, content, keywords, updated_at)
    SELECT
      s.id, ${section_key}, ${title}, ${content}, ${keywords}, NOW()
    FROM sources s
    WHERE s.slug = ${sourceSlug}
    ON CONFLICT (source_id, section_key) DO UPDATE SET
      title      = EXCLUDED.title,
      content    = EXCLUDED.content,
      keywords   = EXCLUDED.keywords,
      updated_at = NOW()
  `;
}


// ─────────────────────────────────────────
// Mark source as synced
// ─────────────────────────────────────────
export async function markSourceSynced(sourceSlug: string): Promise<void> {
  await sql`
    UPDATE sources
    SET    last_synced_at = NOW()
    WHERE  slug = ${sourceSlug}
  `;
}
