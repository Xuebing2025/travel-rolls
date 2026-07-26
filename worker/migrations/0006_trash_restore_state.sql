PRAGMA foreign_keys = ON;

ALTER TABLE trips ADD COLUMN deleted_from_status TEXT
  CHECK (deleted_from_status IN ('draft', 'published'));
ALTER TABLE media ADD COLUMN deleted_from_status TEXT
  CHECK (deleted_from_status IN ('uploading', 'processing', 'ready', 'failed'));
