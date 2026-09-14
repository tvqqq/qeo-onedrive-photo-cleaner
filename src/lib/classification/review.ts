import type { AppDatabase } from "@/lib/db/client";
import { isCategorySlug, type CategorySlug } from "@/lib/classification/taxonomy";

export interface CategoryReviewLabel {
  slug: CategorySlug;
  name: string;
  source: string;
  confidence: number | null;
}

export interface CategoryReviewItem {
  photoId: string;
  name: string;
  path: string;
  reviewed: boolean;
  labels: CategoryReviewLabel[];
}

type ReviewQueueRow = {
  photo_id: string;
  photo_name: string;
  path: string;
  classification_reviewed: number;
  slug: string | null;
  category_name: string | null;
  source: string | null;
  confidence: number | null;
  manual_state: string | null;
};

export function listCategoryReviewQueue(
  db: AppDatabase,
  limit = 50,
): CategoryReviewItem[] {
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const rows = db.prepare(`
    WITH queue AS (
      SELECT id, name, path, classification_reviewed, updated_at
      FROM photos
      WHERE deleted_remote_at IS NULL AND classification_reviewed = 0
      ORDER BY updated_at DESC, id
      LIMIT ?
    )
    SELECT
      q.id AS photo_id,
      q.name AS photo_name,
      q.path,
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
        photoId: row.photo_id,
        name: row.photo_name,
        path: row.path,
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
