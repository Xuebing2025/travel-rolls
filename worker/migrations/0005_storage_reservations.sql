PRAGMA foreign_keys = ON;

ALTER TABLE storage_usage ADD COLUMN reserved_bytes INTEGER NOT NULL DEFAULT 0;
