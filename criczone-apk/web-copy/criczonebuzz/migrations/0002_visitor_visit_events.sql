-- Preserve the existing total_visits value. Backfill known active session starts
-- before creating the trigger, so deploying this migration does not recount them.
CREATE TABLE IF NOT EXISTS visitor_visit_events (
  visitor_id TEXT NOT NULL,
  session_started_at INTEGER NOT NULL,
  PRIMARY KEY (visitor_id, session_started_at)
) WITHOUT ROWID;

INSERT OR IGNORE INTO visitor_visit_events(visitor_id, session_started_at)
SELECT visitor_id, first_seen FROM visitor_sessions;

CREATE TRIGGER IF NOT EXISTS visitor_visit_events_increment
AFTER INSERT ON visitor_visit_events
BEGIN
  UPDATE visitor_totals
  SET total_visits = total_visits + 1
  WHERE id = 1;
END;
