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
  -- Growth focus — updated via Telegram /focus command
  growth_focus_type        TEXT DEFAULT 'BUILD_IN_PUBLIC',
  growth_focus_description TEXT DEFAULT 'Share honest insights about building the app and the personal journey behind it.',
  -- Post generation schedule — updated via Telegram /schedule command (cron expression)
  generate_cron            TEXT DEFAULT '0 9 * * *',
  -- Writing samples: paste examples of how you actually write, separated by ---
  -- The AI uses these to match your tone, vocabulary, and sentence structure
  writing_samples          TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Migration: run this if app_config already exists
-- ============================================================
-- ALTER TABLE app_config
--   ADD COLUMN IF NOT EXISTS growth_focus_type        TEXT DEFAULT 'BUILD_IN_PUBLIC',
--   ADD COLUMN IF NOT EXISTS growth_focus_description TEXT DEFAULT 'Share honest insights about building the app and the personal journey behind it.',
--   ADD COLUMN IF NOT EXISTS generate_cron            TEXT DEFAULT '0 9 * * *',
--   ADD COLUMN IF NOT EXISTS writing_samples          TEXT DEFAULT '';

-- Run this if the posts table already exists:
-- ALTER TABLE posts ADD COLUMN IF NOT EXISTS subreddit TEXT NOT NULL DEFAULT '';

-- ============================================================
-- daily_inputs
-- One optional entry per calendar day.
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_inputs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date             DATE UNIQUE NOT NULL,
  what_was_built   TEXT,
  -- Specific facts: numbers, dates, names, events — used to ground every claim in the post
  concrete_details TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Migration: run this if daily_inputs already exists
-- ALTER TABLE daily_inputs ADD COLUMN IF NOT EXISTS concrete_details TEXT;

-- ============================================================
-- posts
-- Generated posts and their lifecycle.
-- status: PENDING | POSTED | DISCARDED
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_input_id       UUID REFERENCES daily_inputs(id) ON DELETE SET NULL,
  subreddit            TEXT NOT NULL DEFAULT '',
  content              TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'PENDING',
  created_at           TIMESTAMPTZ DEFAULT now(),
  posted_at            TIMESTAMPTZ,
  -- Stored so we can edit the Telegram message on regenerate/mark-posted
  telegram_message_id  BIGINT
);

CREATE INDEX IF NOT EXISTS idx_posts_status     ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
