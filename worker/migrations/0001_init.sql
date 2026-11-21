-- Vocket Cloudflare D1 Schema (Migration 0001)

CREATE TABLE IF NOT EXISTS priority_queue (
  sync_key TEXT NOT NULL,
  word_id TEXT NOT NULL,
  queued_at TEXT NOT NULL,
  PRIMARY KEY (sync_key, word_id)
);

CREATE TABLE IF NOT EXISTS assigned_words (
  sync_key TEXT NOT NULL,
  word_id TEXT NOT NULL,
  batch_number INTEGER NOT NULL,
  day_number INTEGER NOT NULL,
  assigned_date TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'AUTO',
  mastery_score INTEGER NOT NULL DEFAULT 0,
  remedial_count INTEGER NOT NULL DEFAULT 0,
  last_tested_at TEXT,
  pronunciation_score INTEGER NOT NULL DEFAULT 0,
  pronunciation_attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (sync_key, word_id)
);

CREATE INDEX IF NOT EXISTS idx_assigned_sync_batch ON assigned_words(sync_key, batch_number);
CREATE INDEX IF NOT EXISTS idx_assigned_sync_mastery ON assigned_words(sync_key, mastery_score);

CREATE TABLE IF NOT EXISTS quiz_history (
  sync_key TEXT NOT NULL,
  client_id TEXT NOT NULL,
  batch_number INTEGER NOT NULL,
  quiz_type TEXT NOT NULL DEFAULT 'BATCH',
  completed_at TEXT NOT NULL,
  total_questions INTEGER NOT NULL,
  total_correct INTEGER NOT NULL,
  details_json TEXT NOT NULL,
  PRIMARY KEY (sync_key, client_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_sync_completed ON quiz_history(sync_key, completed_at DESC);
