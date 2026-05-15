-- Migration: 001_initial_schema
-- Run once against your Neon database.
-- Supports multiple content sources: xml, linkedin, website (and any future additions).

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────
-- Table: sources
-- One row per content origin (xml, linkedin, website, ...)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sources (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT        NOT NULL UNIQUE,   -- 'xml' | 'linkedin' | 'website'
  label          TEXT        NOT NULL,          -- human-readable display name
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the three sources you plan to use
INSERT INTO sources (slug, label) VALUES
  ('xml',      'Resume XML'),
  ('linkedin', 'LinkedIn Profile'),
  ('website',  'Personal Website')
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────
-- Table: content_sections
-- Parsed chunks from any source.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_sections (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID        NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  section_key TEXT        NOT NULL,   -- e.g. 'experience.google', 'skills.languages'
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  keywords    TEXT[]      NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Upsert target: one chunk per (source, key)
  UNIQUE (source_id, section_key)
);

-- Fast lookup by source
CREATE INDEX IF NOT EXISTS idx_sections_source_id
  ON content_sections(source_id);

-- Fast lookup by key (useful for targeted re-ingests)
CREATE INDEX IF NOT EXISTS idx_sections_section_key
  ON content_sections(section_key);

-- Full-text / keyword search via GIN
CREATE INDEX IF NOT EXISTS idx_sections_keywords
  ON content_sections USING GIN(keywords);

-- Postgres full-text search on title + content (bonus, zero extra cost)
CREATE INDEX IF NOT EXISTS idx_sections_fts
  ON content_sections
  USING GIN(to_tsvector('english', title || ' ' || content));


-- ─────────────────────────────────────────
-- Table: query_cache
-- Persistent cache of Gemini answers keyed by normalized question hash.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS query_cache (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_hash   TEXT        NOT NULL UNIQUE,  -- sha256(normalized question)
  question_norm   TEXT        NOT NULL,         -- normalized question (for debugging)
  answer          TEXT        NOT NULL,
  sources_used    TEXT[]      NOT NULL DEFAULT '{}',  -- slugs of sources that contributed
  hit_count       INT         NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_hit_at     TIMESTAMPTZ
);

-- Fast cache lookup (the hot path — every request hits this)
CREATE INDEX IF NOT EXISTS idx_cache_question_hash
  ON query_cache(question_hash);

-- Efficient TTL cleanup (run a cron or Vercel cron job against this)
CREATE INDEX IF NOT EXISTS idx_cache_expires_at
  ON query_cache(expires_at);


-- ─────────────────────────────────────────
-- Helper function: bump hit_count + last_hit_at on cache hit
-- Call this instead of a manual UPDATE in your app code.
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_cache_hit(p_hash TEXT)
RETURNS VOID LANGUAGE SQL AS $$
  UPDATE query_cache
  SET    hit_count  = hit_count + 1,
         last_hit_at = NOW()
  WHERE  question_hash = p_hash
    AND  expires_at > NOW();
$$;


-- ─────────────────────────────────────────
-- Helper function: delete expired cache rows
-- Wire this up to a Vercel Cron Job at /api/cron/purge-cache
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION purge_expired_cache()
RETURNS INT LANGUAGE SQL AS $$
  WITH deleted AS (
    DELETE FROM query_cache
    WHERE  expires_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*)::INT FROM deleted;
$$;
