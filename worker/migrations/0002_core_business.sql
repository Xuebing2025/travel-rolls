PRAGMA foreign_keys = ON;

CREATE TABLE trip_tags (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (trip_id, tag_id)
);

CREATE TABLE trip_media_references (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (trip_id, media_id)
);
CREATE INDEX trip_media_references_media_idx ON trip_media_references(media_id);

INSERT INTO places(
  id,country_code,province_code,city_code,district_code,
  official_name,display_name,level,center_lat,center_lng,map_data_version
) VALUES
  ('cn-110000','CN','110000','110000',NULL,'北京市','北京','city',39.9042,116.4074,'2026-demo'),
  ('cn-140100','CN','140000','140100',NULL,'太原市','太原','city',37.8706,112.5489,'2026-demo'),
  ('cn-140200','CN','140000','140200',NULL,'大同市','大同','city',40.0768,113.3001,'2026-demo'),
  ('cn-210200','CN','210000','210200',NULL,'大连市','大连','city',38.9140,121.6147,'2026-demo'),
  ('cn-330100','CN','330000','330100',NULL,'杭州市','杭州','city',30.2741,120.1551,'2026-demo'),
  ('cn-810000','CN','810000','810000',NULL,'香港特别行政区','香港','region',22.3193,114.1694,'2026-demo')
ON CONFLICT(id) DO NOTHING;
