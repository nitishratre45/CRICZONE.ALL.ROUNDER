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
