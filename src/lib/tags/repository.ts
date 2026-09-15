import type { AppDatabase } from "@/lib/db/client";
import { normalizeTagInput } from "@/lib/tags/normalize";
import type {
  AiTagSuggestion,
  PhotoNeedingTags,
  PhotoTag,
  TagCount,
  TagStateInput,
} from "@/lib/tags/types";
import { TAG_VOCABULARY } from "@/lib/tags/vocabulary";

interface PhotoTagRow {
  slug: string;
  name: string;
  source: "ai" | "manual";
  state: "active" | "removed";
  confidence: number | null;
}

interface TagCountRow {
  slug: string;
  name: string;
  count: number;
}

interface PhotoNeedingTagsRow {
  id: string;
  drive_item_id: string;
  etag: string | null;
}

function tagId(slug: string): string {
  return `tag:${slug}`;
}

export function ensureAiVocabulary(db: AppDatabase): void {
  const now = Date.now();
  const statement = db.prepare(`
    INSERT INTO tags(id, slug, name, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET name = excluded.name
  `);

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const tag of TAG_VOCABULARY) {
      statement.run(tagId(tag.slug), tag.slug, tag.name, now);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function applyManualTag(
  db: AppDatabase,
  photoId: string,
  rawName: string,
  state: "active" | "removed",
): PhotoTag {
  const normalized = normalizeTagInput(rawName);
  const now = Date.now();

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT INTO tags(id, slug, name, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET name = excluded.name
    `).run(tagId(normalized.slug), normalized.slug, normalized.name, now);

    const tag = db.prepare("SELECT id, name FROM tags WHERE slug = ?").get(normalized.slug) as
      | { id: string; name: string }
      | undefined;
    if (!tag) throw new Error(`Failed to resolve tag ${normalized.slug}`);

    db.prepare(`
      INSERT INTO photo_tags(photo_id, tag_id, confidence, source, state, created_at, updated_at)
      VALUES (?, ?, NULL, 'manual', ?, ?, ?)
      ON CONFLICT(photo_id, tag_id) DO UPDATE SET
        confidence = NULL,
        source = 'manual',
        state = excluded.state,
        updated_at = excluded.updated_at
    `).run(photoId, tag.id, state, now, now);

    db.exec("COMMIT");
    return {
      slug: normalized.slug,
      name: tag.name,
      source: "manual",
      state,
      confidence: null,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function listActiveTagsForPhoto(db: AppDatabase, photoId: string): PhotoTag[] {
  return db.prepare(`
    SELECT t.slug, t.name, pt.source, pt.state, pt.confidence
    FROM photo_tags pt
    JOIN tags t ON t.id = pt.tag_id
    WHERE pt.photo_id = ? AND pt.state = 'active'
    ORDER BY t.name COLLATE NOCASE ASC, t.slug ASC
  `).all(photoId) as unknown as PhotoTagRow[];
}

export function listActiveTagsForPhotos(
  db: AppDatabase,
  photoIds: string[],
): Map<string, PhotoTag[]> {
  const result = new Map<string, PhotoTag[]>();
  for (const photoId of photoIds) result.set(photoId, []);
  if (photoIds.length === 0) return result;

  const placeholders = photoIds.map(() => "?").join(", ");
  const rows = db.prepare(`
    SELECT pt.photo_id, t.slug, t.name, pt.source, pt.state, pt.confidence
    FROM photo_tags pt
    JOIN tags t ON t.id = pt.tag_id
    WHERE pt.photo_id IN (${placeholders}) AND pt.state = 'active'
    ORDER BY pt.photo_id ASC, t.name COLLATE NOCASE ASC, t.slug ASC
  `).all(...photoIds) as unknown as Array<PhotoTagRow & { photo_id: string }>;

  for (const row of rows) {
    const tags = result.get(row.photo_id);
    if (!tags) continue;
    tags.push({
      slug: row.slug,
      name: row.name,
      source: row.source,
      state: row.state,
      confidence: row.confidence,
    });
  }
  return result;
}

export function listTagCounts(db: AppDatabase, limit = 24): TagCount[] {
  return db.prepare(`
    SELECT t.slug, t.name, COUNT(*) AS count
    FROM photo_tags pt
    JOIN tags t ON t.id = pt.tag_id
    JOIN photos p ON p.id = pt.photo_id
    WHERE pt.state = 'active' AND p.deleted_remote_at IS NULL
    GROUP BY t.id, t.slug, t.name
    ORDER BY count DESC, t.name COLLATE NOCASE ASC, t.slug ASC
    LIMIT ?
  `).all(limit) as unknown as TagCountRow[];
}

export function listPhotosNeedingTags(
  db: AppDatabase,
  modelId: string,
  taxonomyVersion: string,
): PhotoNeedingTags[] {
  const rows = db.prepare(`
    SELECT p.id, p.drive_item_id, p.etag
    FROM photos p
    LEFT JOIN photo_tag_state pts ON pts.photo_id = p.id
    WHERE p.deleted_remote_at IS NULL
      AND (
        pts.photo_id IS NULL
        OR NOT (pts.tagged_etag IS p.etag)
        OR pts.model_id <> ?
        OR pts.taxonomy_version <> ?
      )
    ORDER BY p.id ASC
  `).all(modelId, taxonomyVersion) as unknown as PhotoNeedingTagsRow[];

  return rows.map((row) => ({
    id: row.id,
    driveItemId: row.drive_item_id,
    etag: row.etag,
  }));
}

export function replaceAiTagsForPhoto(
  db: AppDatabase,
  photoId: string,
  suggestions: AiTagSuggestion[],
  state: TagStateInput,
): void {
  const now = Date.now();

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM photo_tags WHERE photo_id = ? AND source = 'ai'").run(photoId);

    const resolveTag = db.prepare("SELECT id FROM tags WHERE slug = ?");
    const insertTag = db.prepare(`
      INSERT INTO photo_tags(photo_id, tag_id, confidence, source, state, created_at, updated_at)
      VALUES (?, ?, ?, 'ai', 'active', ?, ?)
      ON CONFLICT(photo_id, tag_id) DO NOTHING
    `);

    for (const suggestion of suggestions) {
      const tag = resolveTag.get(suggestion.slug) as { id: string } | undefined;
      if (!tag) continue;
      insertTag.run(photoId, tag.id, suggestion.confidence, now, now);
    }

    db.prepare(`
      INSERT INTO photo_tag_state(photo_id, tagged_etag, model_id, taxonomy_version, tagged_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(photo_id) DO UPDATE SET
        tagged_etag = excluded.tagged_etag,
        model_id = excluded.model_id,
        taxonomy_version = excluded.taxonomy_version,
        tagged_at = excluded.tagged_at
    `).run(photoId, state.taggedEtag, state.modelId, state.taxonomyVersion, state.taggedAt);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
