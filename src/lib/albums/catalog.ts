import type { DriveAlbum } from "@/lib/graph/types";

const ALBUM_CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { expiresAt: number; albums: DriveAlbum[] } | null = null;

export async function listAlbumsCached(
  drive: { listAlbums(): Promise<DriveAlbum[]> },
  now = Date.now(),
): Promise<DriveAlbum[]> {
  if (cache && now < cache.expiresAt) return [...cache.albums];
  const albums = await drive.listAlbums();
  cache = { expiresAt: now + ALBUM_CACHE_TTL_MS, albums: [...albums] };
  return [...albums];
}

export function invalidateAlbumCatalog(): void {
  cache = null;
}
