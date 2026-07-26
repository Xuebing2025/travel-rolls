PRAGMA foreign_keys = ON;

CREATE TABLE notification_state (
  key TEXT PRIMARY KEY,
  level INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER,
  updated_at INTEGER NOT NULL
);
INSERT INTO notification_state(key,level,last_sent_at,updated_at)
VALUES('storage',0,NULL,unixepoch() * 1000);
