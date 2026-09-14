import type { AppDatabase } from "@/lib/db/client";
import type { ClassificationSuggestion } from "@/lib/classification/rules";
import {
  CATEGORY_NAMES,
  TAXONOMY,
  isCategorySlug,
  type CategorySlug,
} from "@/lib/classification/taxonomy";

export interface ModelScore {
  label: string;
  score: number;
}

export interface ManualReviewInput {
  add: string[];
  remove: string[];
  markReviewed?: boolean;
}

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
  const now = Date.now();
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
