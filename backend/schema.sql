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
  growth_focus_description TEXT DEFAULT 'Drive organic growth by sharing honest builder stories that make people curious about Inspire without pitching it. The post should make someone think "I want to try this" without ever asking them to.',
  -- Post generation schedule — updated via Telegram /schedule command (cron expression)
  generate_cron            TEXT DEFAULT '0 9 * * *',
  -- Writing samples: paste examples of how you actually write, separated by ---
  -- The AI uses these to match your tone, vocabulary, and sentence structure
  writing_samples          TEXT DEFAULT '',
  -- Permanent factual grounding injected into every post prompt
  -- Add stable facts here: launch date, user count, personal background, etc.
  concrete_details         TEXT DEFAULT '',
  -- Topic rotation pool — used when no daily input is provided
  post_topics              JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Migration: run this if app_config already exists
-- ============================================================
-- ALTER TABLE app_config
--   ADD COLUMN IF NOT EXISTS growth_focus_type        TEXT DEFAULT 'BUILD_IN_PUBLIC',
--   ADD COLUMN IF NOT EXISTS growth_focus_description TEXT DEFAULT 'Drive organic growth by sharing honest builder stories that make people curious about Inspire without pitching it. The post should make someone think "I want to try this" without ever asking them to.',
--   ADD COLUMN IF NOT EXISTS generate_cron            TEXT DEFAULT '0 9 * * *',
--   ADD COLUMN IF NOT EXISTS writing_samples          TEXT DEFAULT '',
--   ADD COLUMN IF NOT EXISTS concrete_details         TEXT DEFAULT '',
--   ADD COLUMN IF NOT EXISTS post_topics              JSONB DEFAULT '[]';

-- Update existing row with new growth_focus_description:
-- UPDATE app_config SET growth_focus_description = 'Drive organic growth by sharing honest builder stories that make people curious about Inspire without pitching it. The post should make someone think "I want to try this" without ever asking them to.';

-- Update existing row with permanent concrete_details:
-- UPDATE app_config SET concrete_details = $details$ Launched January 1, 2026 on App Store
-- 70 users on App Store
-- ~200 people tried to install on Android, app not available yet
-- Play Store account not approved yet, 15 beta testers waiting
-- Came from friends + personal outreach + ~R$500 Instagram ads
-- Solo developer, building from Brazil
-- Into calisthenics and indoor bouldering
-- Tooth extraction + right shoulder injury mid-2025, 2-3 months stopped everything
-- Idea came at 3am, first day of handstand training
-- April-May 2025: most of core development
-- PostHog planned but not implemented yet $details$;

-- Populate post_topics:
-- UPDATE app_config SET post_topics = '[
--   "The calisthenics and building connection — training and building always move together",
--   "The discipline paradox — building an app about discipline, struggling with discipline to build it",
--   "The injury period — tooth extraction and shoulder, 2-3 months stopped everything, lowest of my lowest, coming back",
--   "The 3am origin — first day of handstand, couldn't sleep, idea at 3am",
--   "Android demand — 200 people tried to install, app not available yet",
--   "The offline philosophy — no backend, no account, no streaks, human and calm by design",
--   "Solo dev reality — building everything alone from Brazil",
--   "The visual proof idea — why photos and videos beat numbers for tracking goals",
--   "Week 2 retention mystery — no analytics, don''t know if users come back",
--   "Getting stuck on small features instead of onboarding, notifications, social"
-- ]'::jsonb;

-- Append second writing sample (append after the existing transcription sample):
-- UPDATE app_config SET writing_samples = writing_samples || E'\n\n--- WRITTEN EXAMPLE (how I write, not just speak) ---\n\nBuilt an App About Seeing Progress. Can''t See My Own.\n\nLaunched Inspire on the App Store in January. 70 users so far. The app is about documenting your goals visually — photos and videos, week by week, so you can actually see yourself evolving over time.\n\nThe problem: I have zero analytics. The app is fully offline and local, no backend, no tracking. Which means I have no idea if anyone is coming back after week 2. I don''t know if the core loop is working. I don''t know if people are adding media on week 3 or if they downloaded it and never opened it again.\n\nThe whole point of the app is that seeing your progress keeps you going. And I can''t see mine.\n\nI''m about to add PostHog to get some anonymous event tracking — goal created, media added, comparison opened. Basic stuff, but enough to know if week 2 is actually happening.\n\nHas anyone gone through this early stage blind spot? How did you figure out if people were actually using what you built?';

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
