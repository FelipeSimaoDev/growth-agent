-- Growth Agent Database Schema (V1 — simplified)
-- Run this in your Supabase SQL editor

-- ============================================================
-- app_config
-- Single row. Update in place. Never insert more than one.
-- ============================================================
CREATE TABLE IF NOT EXISTS app_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name        TEXT NOT NULL,
  description     TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  tone_of_voice   TEXT NOT NULL,
  subreddits      TEXT[] DEFAULT '{}',
  -- context_blocks: array of {title: string, content: string}
  context_blocks  JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- daily_inputs
-- One optional entry per calendar day.
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_inputs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date             DATE UNIQUE NOT NULL,
  what_was_built   TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- posts
-- Generated posts and their lifecycle.
-- status: PENDING | POSTED
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_input_id       UUID REFERENCES daily_inputs(id) ON DELETE SET NULL,
  content              TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'PENDING',
  created_at           TIMESTAMPTZ DEFAULT now(),
  posted_at            TIMESTAMPTZ,
  -- Stored so we can edit the Telegram message on regenerate/mark-posted
  telegram_message_id  BIGINT
);

CREATE INDEX IF NOT EXISTS idx_posts_status     ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
