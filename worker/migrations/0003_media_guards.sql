PRAGMA foreign_keys = ON;

ALTER TABLE trips ADD COLUMN date_source TEXT NOT NULL DEFAULT 'auto'
  CHECK (date_source IN ('auto', 'manual'));
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id),
  updated_at INTEGER NOT NULL
);
INSERT INTO site_settings(key,value,updated_by,updated_at)
VALUES('subtitle','以照片记录走过的经纬',NULL,unixepoch() * 1000);

CREATE TRIGGER media_city_limit_before_insert
BEFORE INSERT ON media
WHEN (
  SELECT COUNT(*)
  FROM media existing
  JOIN places existing_place ON existing_place.id = existing.place_id
  JOIN places incoming_place ON incoming_place.id = NEW.place_id
  WHERE existing_place.country_code = incoming_place.country_code
    AND existing_place.city_code = incoming_place.city_code
    AND existing.status != 'trash'
) >= 500
BEGIN
  SELECT RAISE(ABORT, 'city_limit_reached');
END;

CREATE INDEX media_captured_idx ON media(captured_at);
CREATE INDEX media_status_purge_idx ON media(status, purge_after);
CREATE INDEX likes_media_idx ON likes(media_id);
CREATE INDEX favorites_media_idx ON favorites(media_id);
