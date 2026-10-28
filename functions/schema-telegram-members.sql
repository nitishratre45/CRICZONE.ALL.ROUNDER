-- Run this SQL in the Cloudflare D1 console for the database bound as TELEGRAM_DB.
CREATE TABLE IF NOT EXISTS telegram_members (
  telegram_id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  membership_status TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  auth_date INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_telegram_members_verified_at ON telegram_members(verified_at DESC);

-- Telegram bot /start audit log. Records begin only after the webhook is deployed and receives updates.
CREATE TABLE IF NOT EXISTS telegram_bot_starts (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  language_code TEXT NOT NULL DEFAULT '',
  start_payload TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  chat_type TEXT NOT NULL DEFAULT 'private'
);
CREATE INDEX IF NOT EXISTS idx_telegram_bot_starts_started_at ON telegram_bot_starts(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_bot_starts_user ON telegram_bot_starts(telegram_id);
