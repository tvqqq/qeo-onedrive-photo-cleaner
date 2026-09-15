import { randomUUID } from "node:crypto";
import type { AppDatabase } from "@/lib/db/client";
import { getPhotoById } from "@/lib/db/repositories";
import type { GraphDriveItem } from "@/lib/graph/types";

export interface LibraryDeleteDriveApi {
  getItem(itemId: string): Promise<GraphDriveItem>;
  deleteItem(itemId: string, ifMatch?: string): Promise<void>;
}

export async function deleteLibraryPhoto(
  context: {
    db: AppDatabase;
    drive: LibraryDeleteDriveApi;
    demoMode: boolean;
  },
  photoId: string,
): Promise<{ deleted: true }> {
  if (context.demoMode) throw new Error("Demo mode never deletes OneDrive photos");

  const photo = getPhotoById(context.db, photoId);
  if (!photo || photo.deletedRemoteAt !== null) throw new Error("Photo is not available");
  if (!photo.etag) throw new Error("Missing local ETag; scan the photo again before deleting");

  const remote = await context.drive.getItem(photo.driveItemId);
  if (!remote.eTag) throw new Error("Missing remote ETag; deletion aborted");
  if (remote.eTag !== photo.etag) throw new Error("Photo changed after the last scan; scan again before deleting");

  await context.drive.deleteItem(photo.driveItemId, photo.etag);

  const now = Date.now();
  context.db.exec("BEGIN IMMEDIATE");
  try {
    context.db.prepare(`
      INSERT INTO deletion_log(id, photo_id, drive_item_id, previous_etag, deleted_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(randomUUID(), photo.id, photo.driveItemId, photo.etag, now);
    context.db.prepare(`UPDATE photos SET deleted_remote_at = ?, updated_at = ? WHERE id = ?`)
      .run(now, now, photo.id);
    context.db.prepare(`UPDATE drive_nodes SET deleted_remote_at = ?, updated_at = ? WHERE drive_item_id = ?`)
      .run(now, now, photo.driveItemId);
    context.db.exec("COMMIT");
  } catch (error) {
    context.db.exec("ROLLBACK");
    throw error;
  }

  return { deleted: true };
}
