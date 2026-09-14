export const SCHEMA_VERSION = 1;

export const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS drive_nodes (
  drive_item_id TEXT PRIMARY KEY,
  parent_drive_item_id TEXT,
  name TEXT NOT NULL,
  is_folder INTEGER NOT NULL DEFAULT 0,
  etag TEXT,
  remote_created_at INTEGER,
  remote_modified_at INTEGER,
  deleted_remote_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS drive_nodes_parent_idx ON drive_nodes(parent_drive_item_id);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  drive_item_id TEXT NOT NULL UNIQUE REFERENCES drive_nodes(drive_item_id),
  name TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  quickxor_hash TEXT,
  sha256 TEXT,
  sha256_etag TEXT,
  width INTEGER,
  height INTEGER,
  taken_at INTEGER,
  remote_created_at INTEGER,
  remote_modified_at INTEGER,
  etag TEXT,
  deleted_remote_at INTEGER,
  classification_reviewed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_quickxor_size_idx ON photos(quickxor_hash, size_bytes);

CREATE TABLE IF NOT EXISTS scan_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
  payload_json TEXT NOT NULL,
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_status_created_idx ON jobs(status, created_at);

CREATE TABLE IF NOT EXISTS duplicate_groups (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('exact','similar')),
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_sha256 TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS duplicate_group_items (
  group_id TEXT NOT NULL REFERENCES duplicate_groups(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  recommended_keep INTEGER NOT NULL DEFAULT 0,
  selected_for_delete INTEGER NOT NULL DEFAULT 0,
  reviewed_etag TEXT,
  PRIMARY KEY(group_id, photo_id)
);

CREATE TABLE IF NOT EXISTS photo_features (
  photo_id TEXT PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
  dhash TEXT,
  lsh_band_0 INTEGER,
  lsh_band_1 INTEGER,
  lsh_band_2 INTEGER,
  lsh_band_3 INTEGER,
  clip_embedding BLOB,
  feature_etag TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS photo_features_band0_idx ON photo_features(lsh_band_0);
CREATE INDEX IF NOT EXISTS photo_features_band1_idx ON photo_features(lsh_band_1);
CREATE INDEX IF NOT EXISTS photo_features_band2_idx ON photo_features(lsh_band_2);
CREATE INDEX IF NOT EXISTS photo_features_band3_idx ON photo_features(lsh_band_3);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photo_categories (
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  confidence REAL,
  source TEXT NOT NULL CHECK(source IN ('rule','local-ai','manual')),
  manual_state TEXT,
  reviewed_at INTEGER,
  PRIMARY KEY(photo_id, category_id)
);

CREATE TABLE IF NOT EXISTS album_sync (
  category_id TEXT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
  onedrive_bundle_id TEXT,
  last_synced_at INTEGER
);

CREATE TABLE IF NOT EXISTS album_sync_items (
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  drive_item_id TEXT NOT NULL,
  synced_at INTEGER NOT NULL,
  PRIMARY KEY(category_id, photo_id)
);

CREATE TABLE IF NOT EXISTS deletion_log (
  id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL,
  drive_item_id TEXT NOT NULL,
  previous_etag TEXT,
  deleted_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;
