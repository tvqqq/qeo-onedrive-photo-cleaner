import type { AppDatabase } from "./client";
import type { GraphDriveItem } from "@/lib/graph/types";

function toMillis(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface PhotoRecord {
  id: string;
  driveItemId: string;
  name: string;
  path: string;
  sizeBytes: number;
  mimeType: string | null;
  quickxorHash: string | null;
  width: number | null;
  height: number | null;
  etag: string | null;
  deletedRemoteAt: number | null;
}

type PhotoRow = {
  id: string;
  drive_item_id: string;
  name: string;
  path: string;
  size_bytes: number;
  mime_type: string | null;
  quickxor_hash: string | null;
  width: number | null;
  height: number | null;
  etag: string | null;
  deleted_remote_at: number | null;
};

function mapPhoto(row: PhotoRow): PhotoRecord {
  return {
    id: row.id,
    driveItemId: row.drive_item_id,
    name: row.name,
    path: row.path,
    sizeBytes: row.size_bytes,
    mimeType: row.mime_type,
    quickxorHash: row.quickxor_hash,
    width: row.width,
    height: row.height,
    etag: row.etag,
    deletedRemoteAt: row.deleted_remote_at,
  };
}

export function findPhotoByDriveId(db: AppDatabase, driveItemId: string): PhotoRecord | null {
  const row = db.prepare(`
    SELECT id, drive_item_id, name, path, size_bytes, mime_type, quickxor_hash,
           width, height, etag, deleted_remote_at
    FROM photos WHERE drive_item_id = ?
  `).get(driveItemId) as PhotoRow | undefined;
  return row ? mapPhoto(row) : null;
}

export function getPhotoById(db: AppDatabase, photoId: string): PhotoRecord | null {
  const row = db.prepare(`
    SELECT id, drive_item_id, name, path, size_bytes, mime_type, quickxor_hash,
           width, height, etag, deleted_remote_at
    FROM photos WHERE id = ?
  `).get(photoId) as PhotoRow | undefined;
  return row ? mapPhoto(row) : null;
}

export function getScanState(db: AppDatabase, key: string): string | null {
  const row = db.prepare("SELECT value FROM scan_state WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setScanState(db: AppDatabase, key: string, value: string): void {
  const now = Date.now();
  db.prepare(`
    INSERT INTO scan_state(key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);
}

export function upsertDriveNode(db: AppDatabase, item: GraphDriveItem, now = Date.now()): void {
  const existing = db.prepare(`SELECT name, is_folder FROM drive_nodes WHERE drive_item_id = ?`)
    .get(item.id) as { name: string; is_folder: number } | undefined;
  const name = item.name ?? existing?.name ?? item.id;
  const isFolder = item.folder !== undefined ? 1 : (existing?.is_folder ?? 0);
  const deletedRemoteAt = item.deleted ? now : null;

  db.prepare(`
    INSERT INTO drive_nodes(
      drive_item_id, parent_drive_item_id, name, is_folder, etag,
      remote_created_at, remote_modified_at, deleted_remote_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(drive_item_id) DO UPDATE SET
      parent_drive_item_id = COALESCE(excluded.parent_drive_item_id, drive_nodes.parent_drive_item_id),
      name = excluded.name,
      is_folder = excluded.is_folder,
      etag = COALESCE(excluded.etag, drive_nodes.etag),
      remote_created_at = COALESCE(excluded.remote_created_at, drive_nodes.remote_created_at),
      remote_modified_at = COALESCE(excluded.remote_modified_at, drive_nodes.remote_modified_at),
      deleted_remote_at = excluded.deleted_remote_at,
      updated_at = excluded.updated_at
  `).run(item.id, item.parentReference?.id ?? null, name, isFolder, item.eTag ?? null,
    toMillis(item.createdDateTime), toMillis(item.lastModifiedDateTime), deletedRemoteAt, now);
}

export function resolveDriveItemPath(db: AppDatabase, driveItemId: string): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let currentId: string | null = driveItemId;
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const row = db.prepare(`SELECT name, parent_drive_item_id FROM drive_nodes WHERE drive_item_id = ?`)
      .get(currentId) as { name: string; parent_drive_item_id: string | null } | undefined;
    if (!row) break;
    parts.unshift(row.name);
    currentId = row.parent_drive_item_id;
  }
  return `/${parts.join("/")}`;
}

export function upsertPhoto(db: AppDatabase, item: GraphDriveItem, now = Date.now()): void {
  if (!item.file?.mimeType?.startsWith("image/")) return;
  const existing = db.prepare(`SELECT id, created_at FROM photos WHERE drive_item_id = ?`)
    .get(item.id) as { id: string; created_at: number } | undefined;
  const id = existing?.id ?? item.id;
  const createdAt = existing?.created_at ?? now;
  const path = resolveDriveItemPath(db, item.id);

  db.prepare(`
    INSERT INTO photos(
      id, drive_item_id, name, path, size_bytes, mime_type, quickxor_hash,
      width, height, taken_at, remote_created_at, remote_modified_at, etag,
      deleted_remote_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT(drive_item_id) DO UPDATE SET
      name = excluded.name, path = excluded.path, size_bytes = excluded.size_bytes,
      mime_type = excluded.mime_type, quickxor_hash = excluded.quickxor_hash,
      width = excluded.width, height = excluded.height, taken_at = excluded.taken_at,
      remote_created_at = excluded.remote_created_at, remote_modified_at = excluded.remote_modified_at,
      sha256 = CASE WHEN photos.etag = excluded.etag THEN photos.sha256 ELSE NULL END,
      sha256_etag = CASE WHEN photos.etag = excluded.etag THEN photos.sha256_etag ELSE NULL END,
      etag = excluded.etag, deleted_remote_at = NULL, updated_at = excluded.updated_at
  `).run(id, item.id, item.name ?? item.id, path, item.size ?? 0, item.file.mimeType ?? null,
    item.file.hashes?.quickXorHash ?? null, item.photo?.width ?? null, item.photo?.height ?? null,
    toMillis(item.photo?.takenDateTime), toMillis(item.createdDateTime),
    toMillis(item.lastModifiedDateTime), item.eTag ?? null, createdAt, now);
}

export function markDriveItemDeleted(db: AppDatabase, driveItemId: string, now = Date.now()): void {
  db.prepare(`UPDATE drive_nodes SET deleted_remote_at = ?, updated_at = ? WHERE drive_item_id = ?`)
    .run(now, now, driveItemId);
  db.prepare(`UPDATE photos SET deleted_remote_at = ?, updated_at = ? WHERE drive_item_id = ?`)
    .run(now, now, driveItemId);
}

export interface DashboardMetrics {
  photoCount: number;
  totalBytes: number;
  activeJob: { id: string; type: string; status: string; progressCurrent: number } | null;
  pendingExactGroups: number;
  pendingSimilarGroups: number;
  reclaimableBytes: number;
  unreviewedCategories: number;
}

export function getDashboardMetrics(db: AppDatabase): DashboardMetrics {
  const totals = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS bytes
    FROM photos WHERE deleted_remote_at IS NULL
  `).get() as { count: number; bytes: number };
  const active = db.prepare(`
    SELECT id, type, status, progress_current FROM jobs
    WHERE status IN ('queued','running') ORDER BY created_at DESC LIMIT 1
  `).get() as { id: string; type: string; status: string; progress_current: number } | undefined;
  const groupCounts = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'exact' AND status = 'pending' THEN 1 ELSE 0 END), 0) AS exact_count,
      COALESCE(SUM(CASE WHEN type = 'similar' AND status = 'pending' THEN 1 ELSE 0 END), 0) AS similar_count
    FROM duplicate_groups
  `).get() as { exact_count: number; similar_count: number };
  const reclaim = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN dgi.recommended_keep = 0 THEN p.size_bytes ELSE 0 END), 0) AS bytes
    FROM duplicate_groups dg
    JOIN duplicate_group_items dgi ON dgi.group_id = dg.id
    JOIN photos p ON p.id = dgi.photo_id
    WHERE dg.type = 'exact' AND dg.status = 'pending' AND p.deleted_remote_at IS NULL
  `).get() as { bytes: number };
  const categories = db.prepare(`
    SELECT COUNT(*) AS count FROM photo_categories WHERE reviewed_at IS NULL
  `).get() as { count: number };

  return {
    photoCount: totals.count,
    totalBytes: totals.bytes,
    activeJob: active ? {
      id: active.id,
      type: active.type,
      status: active.status,
      progressCurrent: active.progress_current,
    } : null,
    pendingExactGroups: groupCounts.exact_count,
    pendingSimilarGroups: groupCounts.similar_count,
    reclaimableBytes: reclaim.bytes,
    unreviewedCategories: categories.count,
  };
}
