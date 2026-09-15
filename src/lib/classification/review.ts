import type { AppDatabase } from "@/lib/db/client";
import { isCategorySlug, type CategorySlug } from "@/lib/classification/taxonomy";
import type { PhotoMetadata } from "@/lib/photos/types";

export interface CategoryReviewLabel {
  slug: CategorySlug;
  name: string;
  source: string;
  confidence: number | null;
}

export interface CategoryReviewItem {
  photo: PhotoMetadata;
  reviewed: boolean;
  labels: CategoryReviewLabel[];
}

type ReviewQueueRow = {
  photo_id: string;
  drive_item_id: string;
  photo_name: string;
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
  classification_reviewed: number;
  slug: string | null;
  category_name: string | null;
  source: string | null;
  confidence: number | null;
  manual_state: string | null;
};

function mapPhoto(row: ReviewQueueRow): PhotoMetadata {
  return {
    photoId: row.photo_id,
    driveItemId: row.drive_item_id,
    name: row.photo_name,
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

export function listCategoryReviewQueue(
  db: AppDatabase,
  limit = 50,
): CategoryReviewItem[] {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const rows = db.prepare(`
    WITH queue AS (
      SELECT
        id,
        drive_item_id,
        name,
        path,
        size_bytes,
        mime_type,
        width,
        height,
        taken_at,
        remote_created_at,
        remote_modified_at,
        camera_make,
        camera_model,
        exposure_numerator,
        exposure_denominator,
        f_number,
        focal_length,
        iso,
        orientation,
        created_by_user_name,
        created_by_device_name,
        created_by_device_id,
        created_by_application_name,
        created_by_application_id,
        modified_by_user_name,
        modified_by_device_name,
        modified_by_device_id,
        modified_by_application_name,
        modified_by_application_id,
        etag,
        quickxor_hash,
        sha256,
        classification_reviewed,
        updated_at
      FROM photos
      WHERE deleted_remote_at IS NULL AND classification_reviewed = 0
      ORDER BY updated_at DESC, id
      LIMIT ?
    )
    SELECT
      q.id AS photo_id,
      q.drive_item_id,
      q.name AS photo_name,
      q.path,
      q.size_bytes,
      q.mime_type,
      q.width,
      q.height,
      q.taken_at,
      q.remote_created_at,
      q.remote_modified_at,
      q.camera_make,
      q.camera_model,
      q.exposure_numerator,
      q.exposure_denominator,
      q.f_number,
      q.focal_length,
      q.iso,
      q.orientation,
      q.created_by_user_name,
      q.created_by_device_name,
      q.created_by_device_id,
      q.created_by_application_name,
      q.created_by_application_id,
      q.modified_by_user_name,
      q.modified_by_device_name,
      q.modified_by_device_id,
      q.modified_by_application_name,
      q.modified_by_application_id,
      q.etag,
      q.quickxor_hash,
      q.sha256,
      q.classification_reviewed,
      c.slug,
      c.name AS category_name,
      pc.source,
      pc.confidence,
      pc.manual_state
    FROM queue q
    LEFT JOIN photo_categories pc ON pc.photo_id = q.id
    LEFT JOIN categories c ON c.id = pc.category_id
    ORDER BY q.updated_at DESC, q.id, c.slug
  `).all(safeLimit) as ReviewQueueRow[];

  const byPhoto = new Map<string, CategoryReviewItem>();
  for (const row of rows) {
    let item = byPhoto.get(row.photo_id);
    if (!item) {
      item = {
        photo: mapPhoto(row),
        reviewed: Boolean(row.classification_reviewed),
        labels: [],
      };
      byPhoto.set(row.photo_id, item);
    }

    if (
      row.slug &&
      row.category_name &&
      row.source &&
      isCategorySlug(row.slug) &&
      !(row.source === "manual" && row.manual_state === "removed")
    ) {
      item.labels.push({
        slug: row.slug,
        name: row.category_name,
        source: row.source,
        confidence: row.confidence,
      });
    }
  }

  return [...byPhoto.values()];
}
