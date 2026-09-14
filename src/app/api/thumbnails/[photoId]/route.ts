import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth/msal";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { getPhotoById } from "@/lib/db/repositories";
import { env } from "@/lib/env";
import { GraphClient } from "@/lib/graph/client";
import { DriveApi } from "@/lib/graph/drive";
import { DemoDriveApi } from "@/lib/scan/demo";
import { detectImageMime, getThumbnailPath } from "@/lib/thumbnails/cache";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await context.params;
  const db = openAppDatabase();
  try {
    migrateDatabase(db);
    const photo = getPhotoById(db, photoId);
    if (!photo || photo.deletedRemoteAt) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    const drive = env.DEMO_MODE
      ? new DemoDriveApi()
      : new DriveApi(new GraphClient(getAccessToken));
    const path = await getThumbnailPath(photo, drive);
    const bytes = new Uint8Array(await readFile(path));
    return new Response(bytes, {
      headers: {
        "content-type": detectImageMime(bytes),
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  } finally {
    db.close();
  }
}
