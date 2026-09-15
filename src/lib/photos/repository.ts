import type { AppDatabase } from "@/lib/db/client";
import type { PhotoMetadata, PhotoPageResult, PhotoQuery, PhotoSort } from "./types";

const ORDER_BY: Record<PhotoSort, string> = {
  "taken-desc": "COALESCE(p.taken_at, p.remote_modified_at) DESC, p.id DESC",
  "taken-asc": "COALESCE(p.taken_at, p.remote_modified_at) ASC, p.id ASC",
  "modified-desc": "p.remote_modified_at DESC, p.id DESC",
  "modified-asc": "p.remote_modified_at ASC, p.id ASC",
  "size-desc": "p.size_bytes DESC, p.id DESC",
  "size-asc": "p.size_bytes ASC, p.id ASC",
  "name-asc": "p.name COLLATE NOCASE ASC, p.id ASC",
  "name-desc": "p.name COLLATE NOCASE DESC, p.id DESC",
};

type PhotoRow = {
  id: string;
  drive_item_id: string;
  name: string;
  path: string;
  size_bytes: number;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  taken_at: number | null;
  remote_created_at: number | null;
  remote_modified_at: number | null;
  camera_make: string | null;
  camera_model: string | null;
  exposure_numerator: number | null;
  exposure_denominator: number | null;
  f_number: number | null;
  focal_length: number | null;
  iso: number | null;
  orientation: number | null;
  created_by_user_name: string | null;
  created_by_device_name: string | null;
  created_by_device_id: string | null;
  created_by_application_name: string | null;
  created_by_application_id: string | null;
  modified_by_user_name: string | null;
  modified_by_device_name: string | null;
  modified_by_device_id: string | null;
  modified_by_application_name: string | null;
  modified_by_application_id: string | null;
  etag: string | null;
  quickxor_hash: string | null;
  sha256: string | null;
};

function mapPhoto(row: PhotoRow): PhotoMetadata {
  return {
    photoId: row.id,
    driveItemId: row.drive_item_id,
    name: row.name,
    path: row.path,
    sizeBytes: row.size_bytes,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    takenAt: row.taken_at,
    remoteCreatedAt: row.remote_created_at,
    remoteModifiedAt: row.remote_modified_at,
    cameraMake: row.camera_make,
    cameraModel: row.camera_model,
    exposureNumerator: row.exposure_numerator,
    exposureDenominator: row.exposure_denominator,
    fNumber: row.f_number,
    focalLength: row.focal_length,
    iso: row.iso,
    orientation: row.orientation,
    createdByUserName: row.created_by_user_name,
    createdByDeviceName: row.created_by_device_name,
    createdByDeviceId: row.created_by_device_id,
    createdByApplicationName: row.created_by_application_name,
    createdByApplicationId: row.created_by_application_id,
    modifiedByUserName: row.modified_by_user_name,
    modifiedByDeviceName: row.modified_by_device_name,
    modifiedByDeviceId: row.modified_by_device_id,
    modifiedByApplicationName: row.modified_by_application_name,
    modifiedByApplicationId: row.modified_by_application_id,
    etag: row.etag,
    quickxorHash: row.quickxor_hash,
    sha256: row.sha256,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function buildWhere(query: PhotoQuery): { sql: string; args: Array<string | number> } {
  const clauses = ["p.deleted_remote_at IS NULL"];
  const args: Array<string | number> = [];

  if (query.search) {
    const like = `%${escapeLike(query.search)}%`;
    clauses.push(`(
      p.name LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      p.path LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      p.camera_make LIKE ? ESCAPE '\\' COLLATE NOCASE OR
      p.camera_model LIKE ? ESCAPE '\\' COLLATE NOCASE
    )`);
    args.push(like, like, like, like);
  }

  if (query.mimeType) {
    clauses.push("p.mime_type = ?");
    args.push(query.mimeType);
  }

  if (query.category) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM photo_categories pc
      JOIN categories c ON c.id = pc.category_id
      WHERE pc.photo_id = p.id
        AND c.slug = ?
        AND NOT (pc.source = 'manual' AND pc.manual_state = 'removed')
    )`);
    args.push(query.category);
  }

  if (query.takenFrom !== undefined) {
    clauses.push("p.taken_at >= ?");
    args.push(query.takenFrom);
  }

  if (query.takenTo !== undefined) {
    clauses.push("p.taken_at <= ?");
    args.push(query.takenTo);
  }

  return { sql: clauses.join(" AND "), args };
}

export function listPhotos(db: AppDatabase, query: PhotoQuery): PhotoPageResult {
  const { sql: whereSql, args } = buildWhere(query);
  const count = db.prepare(`SELECT COUNT(*) AS count FROM photos p WHERE ${whereSql}`)
    .get(...args) as { count: number };

  const offset = (query.page - 1) * query.pageSize;
  const rows = db.prepare(`
    SELECT
      p.id, p.drive_item_id, p.name, p.path, p.size_bytes, p.mime_type,
      p.width, p.height, p.taken_at, p.remote_created_at, p.remote_modified_at,
      p.camera_make, p.camera_model, p.exposure_numerator, p.exposure_denominator,
      p.f_number, p.focal_length, p.iso, p.orientation,
      p.created_by_user_name, p.created_by_device_name, p.created_by_device_id,
      p.created_by_application_name, p.created_by_application_id,
      p.modified_by_user_name, p.modified_by_device_name, p.modified_by_device_id,
      p.modified_by_application_name, p.modified_by_application_id,
      p.etag, p.quickxor_hash, p.sha256
    FROM photos p
    WHERE ${whereSql}
    ORDER BY ${ORDER_BY[query.sort]}
    LIMIT ? OFFSET ?
  `).all(...args, query.pageSize, offset) as PhotoRow[];

  return {
    items: rows.map(mapPhoto),
    page: query.page,
    pageSize: query.pageSize,
    total: count.count,
    totalPages: Math.ceil(count.count / query.pageSize),
  };
}
