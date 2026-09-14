export { listCategoryReviewQueue } from "@/lib/classification/review";

import type { AppDatabase } from "@/lib/db/client";
import { classifyByRule, type ClassificationSuggestion } from "@/lib/classification/rules";
import {
  CATEGORY_NAMES,
  TAXONOMY,
  isCategorySlug,
  type CategorySlug,
} from "@/lib/classification/taxonomy";
import { env } from "@/lib/env";
import { updateJobProgress } from "@/lib/jobs/repository";
import { getThumbnailPath, type ThumbnailDriveApi } from "@/lib/thumbnails/cache";

export interface ModelScore {
  label: string;
  score: number;
}

export interface ManualReviewInput {
  add: string[];
  remove: string[];
  markReviewed?: boolean;
}

export interface ClassificationJobContext {
  db: AppDatabase;
  drive: ThumbnailDriveApi;
  classifier: {
    classify(path: string, candidateLabels: string[]): Promise<ModelScore[]>;
  };
  dataDir?: string;
}

type ClassifiablePhotoRow = {
  id: string;
  drive_item_id: string;
  name: string;
  path: string;
  etag: string | null;
};

export function ensureTaxonomy(db: AppDatabase): void {
  const insert = db.prepare(`
    INSERT INTO categories(id, slug, name)
    VALUES (?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET name = excluded.name
  `);
  for (const slug of TAXONOMY) insert.run(slug, slug, CATEGORY_NAMES[slug]);
}

export function selectModelSuggestions(
  scores: ModelScore[],
  minScore = 0.2,
  maxLabels = 3,
): ClassificationSuggestion[] {
  const selected = scores
    .filter((item): item is ModelScore & { label: CategorySlug } =>
      item.score >= minScore && item.label !== "other" && isCategorySlug(item.label),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, maxLabels)
    .map((item) => ({
      slug: item.label,
      confidence: item.score,
      source: "local-ai" as const,
    }));

  return selected.length > 0
    ? selected
    : [{ slug: "other", confidence: 1, source: "local-ai" }];
}

export function writeAutomaticCategories(
  db: AppDatabase,
  photoId: string,
  suggestions: ClassificationSuggestion[],
): void {
  ensureTaxonomy(db);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      DELETE FROM photo_categories
      WHERE photo_id = ? AND source != 'manual'
    `).run(photoId);

    const insert = db.prepare(`
      INSERT INTO photo_categories(
        photo_id, category_id, confidence, source, manual_state, reviewed_at
      )
      SELECT ?, c.id, ?, ?, NULL, NULL
      FROM categories c
      WHERE c.slug = ?
        AND NOT EXISTS (
          SELECT 1 FROM photo_categories existing
          WHERE existing.photo_id = ? AND existing.category_id = c.id AND existing.source = 'manual'
        )
      ON CONFLICT(photo_id, category_id) DO NOTHING
    `);

    for (const suggestion of suggestions) {
      insert.run(
        photoId,
        suggestion.confidence,
        suggestion.source,
        suggestion.slug,
        photoId,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function applyManualReview(
  db: AppDatabase,
  photoId: string,
  input: ManualReviewInput,
): void {
  ensureTaxonomy(db);
  const additions = new Set(input.add);
  const removals = new Set(input.remove);
  for (const slug of [...additions, ...removals]) {
    if (!isCategorySlug(slug)) throw new Error(`Unknown category: ${slug}`);
  }

  const now = Date.now();
  db.exec("BEGIN IMMEDIATE");
  try {
    const upsert = db.prepare(`
      INSERT INTO photo_categories(
        photo_id, category_id, confidence, source, manual_state, reviewed_at
      )
      SELECT ?, id, NULL, 'manual', ?, ? FROM categories WHERE slug = ?
      ON CONFLICT(photo_id, category_id) DO UPDATE SET
        confidence = NULL,
        source = 'manual',
        manual_state = excluded.manual_state,
        reviewed_at = excluded.reviewed_at
    `);
    for (const slug of additions) upsert.run(photoId, "added", now, slug);
    for (const slug of removals) upsert.run(photoId, "removed", now, slug);

    if (input.markReviewed) {
      db.prepare(`
        UPDATE photos SET classification_reviewed = 1, updated_at = ? WHERE id = ?
      `).run(now, photoId);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function runClassificationJob(
  context: ClassificationJobContext,
  jobId: string,
): Promise<void> {
  ensureTaxonomy(context.db);
  const photos = context.db.prepare(`
    SELECT id, drive_item_id, name, path, etag
    FROM photos
    WHERE deleted_remote_at IS NULL AND classification_reviewed = 0
    ORDER BY id
  `).all() as ClassifiablePhotoRow[];
  const candidateLabels = TAXONOMY.filter((slug) => slug !== "other");

  let processed = 0;
  for (const photo of photos) {
    const ruleSuggestions = classifyByRule({ name: photo.name, path: photo.path });
    let suggestions: ClassificationSuggestion[];

    if (ruleSuggestions.length > 0) {
      suggestions = ruleSuggestions;
    } else {
      const thumbnailPath = await getThumbnailPath(
        { driveItemId: photo.drive_item_id, etag: photo.etag },
        context.drive,
        context.dataDir ?? env.DATA_DIR,
      );
      const scores = await context.classifier.classify(thumbnailPath, [...candidateLabels]);
      suggestions = selectModelSuggestions(scores);
    }

    writeAutomaticCategories(context.db, photo.id, suggestions);
    processed += 1;
    updateJobProgress(context.db, jobId, processed, photos.length);
  }
}
