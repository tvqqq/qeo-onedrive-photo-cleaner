import { randomUUID } from "node:crypto";
import type { AppDatabase } from "@/lib/db/client";

interface DeleteDriveApi {
  getItem(itemId: string): Promise<{ id: string; eTag?: string }>;
  deleteItem(itemId: string, ifMatch?: string): Promise<void>;
}

export interface DeleteContext {
  db: AppDatabase;
  drive: DeleteDriveApi;
}

export interface DeleteResult {
  deleted: number;
  reclaimedBytes: number;
}

type GroupItem = {
  photo_id: string;
  drive_item_id: string;
  size_bytes: number;
  recommended_keep: number;
  reviewed_etag: string | null;
};

export async function deleteApprovedExactGroup(
  context: DeleteContext,
  groupId: string,
  selectedPhotoIds: string[],
): Promise<DeleteResult> {
  const group = context.db.prepare(`
    SELECT type, status, verified_sha256 FROM duplicate_groups WHERE id = ?
  `).get(groupId) as { type: string; status: string; verified_sha256: string | null } | undefined;
  if (!group || group.type !== "exact" || !group.verified_sha256) {
    throw new Error("Only verified exact duplicate groups can be deleted");
  }

  const rows = context.db.prepare(`
    SELECT dgi.photo_id, p.drive_item_id, p.size_bytes, dgi.recommended_keep, dgi.reviewed_etag
    FROM duplicate_group_items dgi
    JOIN photos p ON p.id = dgi.photo_id
    WHERE dgi.group_id = ? AND p.deleted_remote_at IS NULL
  `).all(groupId) as GroupItem[];
  const byId = new Map(rows.map((row) => [row.photo_id, row]));
  const selected = [...new Set(selectedPhotoIds)].map((id) => {
    const item = byId.get(id);
    if (!item) throw new Error(`Photo ${id} is not part of this verified group`);
    if (item.recommended_keep) throw new Error("The recommended keeper cannot be deleted");
    if (!item.reviewed_etag) throw new Error("Missing reviewed ETag; review the group again");
    return item;
  });

  const preflight: Array<{ row: GroupItem; etag: string }> = [];
  for (const row of selected) {
    const current = await context.drive.getItem(row.drive_item_id);
    if (!current.eTag || current.eTag !== row.reviewed_etag) {
      context.db.prepare("UPDATE duplicate_groups SET status = 'pending' WHERE id = ?").run(groupId);
      throw new Error("Item changed after review");
    }
    preflight.push({ row, etag: current.eTag });
  }

  let reclaimedBytes = 0;
  for (const { row, etag } of preflight) {
    await context.drive.deleteItem(row.drive_item_id, etag);
    const now = Date.now();
    context.db.exec("BEGIN IMMEDIATE");
    try {
      context.db.prepare(`
        INSERT INTO deletion_log(id, photo_id, drive_item_id, previous_etag, deleted_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(randomUUID(), row.photo_id, row.drive_item_id, etag, now);
      context.db.prepare(`UPDATE photos SET deleted_remote_at = ?, updated_at = ? WHERE id = ?`)
        .run(now, now, row.photo_id);
      context.db.prepare(`UPDATE drive_nodes SET deleted_remote_at = ?, updated_at = ? WHERE drive_item_id = ?`)
        .run(now, now, row.drive_item_id);
      context.db.prepare(`
        UPDATE duplicate_group_items SET selected_for_delete = 1 WHERE group_id = ? AND photo_id = ?
      `).run(groupId, row.photo_id);
      context.db.exec("COMMIT");
    } catch (error) {
      context.db.exec("ROLLBACK");
      throw error;
    }
    reclaimedBytes += row.size_bytes;
  }

  if (selected.length > 0) {
    const remaining = context.db.prepare(`
      SELECT COUNT(*) AS count
      FROM duplicate_group_items dgi
      JOIN photos p ON p.id = dgi.photo_id
      WHERE dgi.group_id = ?
        AND dgi.recommended_keep = 0
        AND p.deleted_remote_at IS NULL
    `).get(groupId) as { count: number };
    context.db.prepare(`
      UPDATE duplicate_groups SET status = ?, reviewed_at = ? WHERE id = ?
    `).run(remaining.count === 0 ? "completed" : "pending", Date.now(), groupId);
  }
  return { deleted: selected.length, reclaimedBytes };
}
