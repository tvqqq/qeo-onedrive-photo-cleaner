import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "@/lib/env";

export interface ThumbnailPhoto {
  driveItemId: string;
  etag: string | null;
}

export interface ThumbnailDriveApi {
  getThumbnailContent(itemId: string, size?: string): Promise<ArrayBuffer>;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function cacheKey(photo: ThumbnailPhoto): string {
  return createHash("sha256")
    .update(`${photo.driveItemId}\0${photo.etag ?? "no-etag"}`)
    .digest("hex");
}

export async function getThumbnailPath(
  photo: ThumbnailPhoto,
  drive: ThumbnailDriveApi,
  dataDir = env.DATA_DIR,
): Promise<string> {
  const directory = join(dataDir, "cache", "thumbnails");
  await mkdir(directory, { recursive: true });
  const finalPath = join(directory, `${cacheKey(photo)}.img`);
  if (await exists(finalPath)) return finalPath;

  const bytes = new Uint8Array(await drive.getThumbnailContent(photo.driveItemId, "large"));
  const temporaryPath = join(directory, `.${cacheKey(photo)}.${randomUUID()}.tmp`);
  await writeFile(temporaryPath, bytes, { flag: "wx" });
  try {
    await rename(temporaryPath, finalPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    if (!(await exists(finalPath))) throw error;
  }
  return finalPath;
}

export async function clearThumbnailCache(
  dataDir = env.DATA_DIR,
): Promise<{ removedFiles: number }> {
  const directory = join(dataDir, "cache", "thumbnails");
  let removedFiles = 0;
  try {
    removedFiles = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .length;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
  await rm(directory, { recursive: true, force: true });
  return { removedFiles };
}

export function detectImageMime(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
  return "application/octet-stream";
}
