import type { AppDatabase } from "@/lib/db/client";

export interface AlbumDriveApi {
  createAlbum(name: string, itemIds?: string[]): Promise<string>;
  addAlbumItems(albumId: string, itemIds: string[]): Promise<void>;
}

export interface AlbumSyncContext {
  db: AppDatabase;
  drive: AlbumDriveApi;
}

type CategoryRow = {
  id: string;
  name: string;
};

type AlbumSyncRow = {
  onedrive_bundle_id: string | null;
};

type AlbumMemberRow = {
  photo_id: string;
  drive_item_id: string;
};

export async function syncCategoryAlbum(
  context: AlbumSyncContext,
  categoryId: string,
): Promise<{ albumId: string; added: number }> {
  const category = context.db.prepare(`
    SELECT id, name FROM categories WHERE id = ? OR slug = ? LIMIT 1
  `).get(categoryId, categoryId) as CategoryRow | undefined;
  if (!category) throw new Error(`Unknown category: ${categoryId}`);

  let sync = context.db.prepare(`
    SELECT onedrive_bundle_id FROM album_sync WHERE category_id = ?
  `).get(category.id) as AlbumSyncRow | undefined;

  let albumId = sync?.onedrive_bundle_id ?? null;
  if (!albumId) {
    albumId = await context.drive.createAlbum(category.name);
    context.db.prepare(`
      INSERT INTO album_sync(category_id, onedrive_bundle_id, last_synced_at)
      VALUES (?, ?, NULL)
      ON CONFLICT(category_id) DO UPDATE SET onedrive_bundle_id = excluded.onedrive_bundle_id
    `).run(category.id, albumId);
    sync = { onedrive_bundle_id: albumId };
  }

  const members = context.db.prepare(`
    SELECT p.id AS photo_id, p.drive_item_id
    FROM photos p
    JOIN photo_categories pc ON pc.photo_id = p.id
    LEFT JOIN album_sync_items asi
      ON asi.category_id = pc.category_id AND asi.photo_id = p.id
    WHERE pc.category_id = ?
      AND p.classification_reviewed = 1
      AND p.deleted_remote_at IS NULL
      AND NOT (pc.source = 'manual' AND pc.manual_state = 'removed')
      AND asi.photo_id IS NULL
    ORDER BY p.id
  `).all(category.id) as AlbumMemberRow[];

  let added = 0;
  for (const member of members) {
    await context.drive.addAlbumItems(albumId, [member.drive_item_id]);
    const now = Date.now();
    context.db.prepare(`
      INSERT INTO album_sync_items(category_id, photo_id, drive_item_id, synced_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(category_id, photo_id) DO NOTHING
    `).run(category.id, member.photo_id, member.drive_item_id, now);
    added += 1;
  }

  context.db.prepare(`
    UPDATE album_sync SET last_synced_at = ? WHERE category_id = ?
  `).run(Date.now(), category.id);

  return { albumId, added };
}
