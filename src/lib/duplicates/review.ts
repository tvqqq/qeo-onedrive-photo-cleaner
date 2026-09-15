import type { AppDatabase } from "@/lib/db/client";
import type { PhotoMetadata } from "@/lib/photos/types";

export interface ExactReviewItem {
  photo: PhotoMetadata;
  recommendedKeep: boolean;
  selectedForDelete: boolean;
}

export interface SimilarReviewItem {
  photo: PhotoMetadata;
}

export type DuplicateReviewGroup =
  | {
      id: string;
      type: "exact";
      verifiedSha256: string;
      items: ExactReviewItem[];
    }
  | {
      id: string;
      type: "similar";
      confidence: number | null;
      items: SimilarReviewItem[];
    };

type ReviewRow = {
  group_id: string;
  group_type: "exact" | "similar";
  confidence: number | null;
  verified_sha256: string | null;
  recommended_keep: number;
  selected_for_delete: number;
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

function mapPhoto(row: ReviewRow): PhotoMetadata {
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
    tags: [],
  };
}

export function listPendingDuplicateReviewGroups(db: AppDatabase): DuplicateReviewGroup[] {
  const rows = db.prepare(`
    SELECT
      dg.id AS group_id,
      dg.type AS group_type,
      dg.confidence,
      dg.verified_sha256,
      dgi.recommended_keep,
      dgi.selected_for_delete,
      p.id,
      p.drive_item_id,
      p.name,
      p.path,
      p.size_bytes,
      p.mime_type,
      p.width,
      p.height,
      p.taken_at,
      p.remote_created_at,
      p.remote_modified_at,
      p.camera_make,
      p.camera_model,
      p.exposure_numerator,
      p.exposure_denominator,
      p.f_number,
      p.focal_length,
      p.iso,
      p.orientation,
      p.created_by_user_name,
      p.created_by_device_name,
      p.created_by_device_id,
      p.created_by_application_name,
      p.created_by_application_id,
      p.modified_by_user_name,
      p.modified_by_device_name,
      p.modified_by_device_id,
      p.modified_by_application_name,
      p.modified_by_application_id,
      p.etag,
      p.quickxor_hash,
      p.sha256
    FROM duplicate_groups dg
    JOIN duplicate_group_items dgi ON dgi.group_id = dg.id
    JOIN photos p ON p.id = dgi.photo_id
    WHERE dg.status = 'pending'
      AND p.deleted_remote_at IS NULL
      AND (dg.type = 'similar' OR dg.verified_sha256 IS NOT NULL)
    ORDER BY dg.created_at DESC, dgi.recommended_keep DESC, p.name COLLATE NOCASE
  `).all() as ReviewRow[];

  const groups: DuplicateReviewGroup[] = [];
  const byId = new Map<string, DuplicateReviewGroup>();

  for (const row of rows) {
    let group = byId.get(row.group_id);
    if (!group) {
      if (row.group_type === "exact") {
        if (!row.verified_sha256) continue;
        group = {
          id: row.group_id,
          type: "exact",
          verifiedSha256: row.verified_sha256,
          items: [],
        };
      } else {
        group = {
          id: row.group_id,
          type: "similar",
          confidence: row.confidence,
          items: [],
        };
      }
      byId.set(row.group_id, group);
      groups.push(group);
    }

    const photo = mapPhoto(row);
    if (group.type === "exact") {
      group.items.push({
        photo,
        recommendedKeep: Boolean(row.recommended_keep),
        selectedForDelete: Boolean(row.selected_for_delete),
      });
    } else {
      group.items.push({ photo });
    }
  }

  return groups;
}
