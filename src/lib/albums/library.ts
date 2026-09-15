import type { AppDatabase } from "@/lib/db/client";
import { getPhotoById } from "@/lib/db/repositories";
import { GraphRequestError } from "@/lib/graph/client";

export interface LibraryAlbumDriveApi {
  listAlbumItemIds(albumId: string): Promise<Set<string>>;
  addAlbumItems(albumId: string, itemIds: string[]): Promise<void>;
}

export class AlbumNotFoundError extends Error {
  override readonly name = "AlbumNotFoundError";

  constructor() {
    super("OneDrive album no longer exists");
  }
}

function isItemNotFound(error: unknown): error is GraphRequestError {
  return error instanceof GraphRequestError &&
    error.status === 404 &&
    (error.code === null || error.code.toLowerCase() === "itemnotfound");
}

export async function addPhotoToExistingAlbum(
  context: { db: AppDatabase; drive: LibraryAlbumDriveApi },
  photoId: string,
  albumId: string,
): Promise<{ added: boolean }> {
  const photo = getPhotoById(context.db, photoId);
  if (!photo || photo.deletedRemoteAt !== null) throw new Error("Photo is not available");

  let memberIds: Set<string>;
  try {
    memberIds = await context.drive.listAlbumItemIds(albumId);
  } catch (error) {
    if (isItemNotFound(error)) throw new AlbumNotFoundError();
    throw error;
  }

  if (memberIds.has(photo.driveItemId)) return { added: false };
  await context.drive.addAlbumItems(albumId, [photo.driveItemId]);
  return { added: true };
}
