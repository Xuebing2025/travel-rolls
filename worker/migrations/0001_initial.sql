PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nickname TEXT NOT NULL,
  avatar_key TEXT,
  role TEXT NOT NULL CHECK (role IN ('visitor', 'editor', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role TEXT NOT NULL CHECK (role IN ('visitor', 'editor')),
  invited_by TEXT NOT NULL REFERENCES users(id),
  revoked_at INTEGER,
  accepted_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE login_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX login_codes_email_created_idx ON login_codes(email, created_at DESC);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_token_idx ON sessions(token_hash);

CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  author_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  subtitle TEXT,
  start_date TEXT,
  end_date TEXT,
  markdown TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'link', 'private')),
  share_token_hash TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'trash')),
  cover_media_id TEXT,
  cover_focus_x REAL NOT NULL DEFAULT 0.5 CHECK (cover_focus_x BETWEEN 0 AND 1),
  cover_focus_y REAL NOT NULL DEFAULT 0.5 CHECK (cover_focus_y BETWEEN 0 AND 1),
  cover_text_side TEXT NOT NULL DEFAULT 'right' CHECK (cover_text_side IN ('left', 'right')),
  cover_text_tone TEXT CHECK (cover_text_tone IN ('light', 'dark')),
  published_at INTEGER,
  deleted_at INTEGER,
  purge_after INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX trips_date_idx ON trips(start_date DESC, published_at DESC);
CREATE INDEX trips_author_idx ON trips(author_id);

CREATE TABLE trip_versions (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  markdown TEXT NOT NULL,
  title TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX trip_versions_trip_idx ON trip_versions(trip_id, created_at DESC);

CREATE TABLE places (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL DEFAULT 'CN',
  province_code TEXT,
  city_code TEXT NOT NULL,
  district_code TEXT,
  official_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('province', 'city', 'district', 'region')),
  center_lat REAL,
  center_lng REAL,
  map_data_version TEXT
);
CREATE INDEX places_city_idx ON places(country_code, city_code);

CREATE TABLE trip_places (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL REFERENCES places(id),
  position INTEGER NOT NULL,
  PRIMARY KEY (trip_id, place_id)
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  place_id TEXT NOT NULL REFERENCES places(id),
  uploader_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  original_key TEXT NOT NULL UNIQUE,
  web_key TEXT,
  thumb_key TEXT,
  poster_key TEXT,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  captured_at TEXT,
  captured_timezone TEXT,
  date_status TEXT NOT NULL DEFAULT 'pending' CHECK (date_status IN ('valid', 'pending', 'corrected')),
  district_code TEXT,
  description TEXT NOT NULL DEFAULT '',
  exif_public_json TEXT NOT NULL DEFAULT '{}',
  content_hash TEXT,
  visual_fingerprint TEXT,
  sort_manual INTEGER NOT NULL DEFAULT 0,
  sort_smart INTEGER,
  sort_time INTEGER,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('uploading', 'processing', 'ready', 'failed', 'trash')),
  deleted_at INTEGER,
  purge_after INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX media_city_limit_idx ON media(place_id, status);
CREATE INDEX media_trip_sort_idx ON media(trip_id, sort_manual);
CREATE UNIQUE INDEX media_exact_duplicate_idx ON media(uploader_id, content_hash) WHERE content_hash IS NOT NULL AND status != 'trash';

CREATE TABLE media_tags (
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, tag_id)
);

CREATE TABLE media_uploads (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  r2_upload_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  expected_size INTEGER NOT NULL,
  part_size INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'aborted')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, media_id)
);

CREATE TABLE favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, media_id)
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at DESC);

CREATE TABLE storage_usage (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  total_bytes INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
INSERT INTO storage_usage(singleton, total_bytes, updated_at) VALUES (1, 0, unixepoch() * 1000);
