import { NextResponse } from "next/server";
import { invalidateAlbumCatalog } from "@/lib/albums/catalog";
import { addPhotoToExistingAlbum, AlbumNotFoundError } from "@/lib/albums/library";
import { getAccessToken } from "@/lib/auth/msal";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { env } from "@/lib/env";
import { GraphClient, GraphRequestError } from "@/lib/graph/client";
import { DriveApi } from "@/lib/graph/drive";
import { enqueueJobIfIdle } from "@/lib/jobs/repository";
import { deleteLibraryPhoto } from "@/lib/photos/delete";
import { assertSameOriginJson } from "@/lib/security/request";
import { applyManualTag } from "@/lib/tags/repository";

export const runtime = "nodejs";

type PhotoAction =
  | { action: "generate-tags" }
  | { action: "add-tag"; photoId: string; tag: string }
  | { action: "remove-tag"; photoId: string; tag: string }
  | { action: "add-to-album"; photoId: string; albumId: string }
  | { action: "delete"; photoId: string };

function assertText(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
}

function isItemNotFound(error: unknown): error is GraphRequestError {
  return error instanceof GraphRequestError &&
    error.status === 404 &&
    (error.code === null || error.code.toLowerCase() === "itemnotfound");
}

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const action = await request.json() as PhotoAction;
    const db = openAppDatabase();
    try {
      migrateDatabase(db);
      if (action.action === "generate-tags") {
        const jobId = enqueueJobIfIdle(db, "tag-photos", {});
        return NextResponse.json({ jobId }, { status: 202 });
      }

      if (action.action === "add-tag" || action.action === "remove-tag") {
        assertText(action.photoId, "photoId");
        assertText(action.tag, "tag");
        const tag = applyManualTag(
          db,
          action.photoId,
          action.tag,
          action.action === "add-tag" ? "active" : "removed",
        );
        return NextResponse.json({ tag });
      }

      if (action.action === "add-to-album") {
        assertText(action.photoId, "photoId");
        assertText(action.albumId, "albumId");
        if (env.DEMO_MODE) throw new Error("Demo mode never changes OneDrive albums");
        const drive = new DriveApi(new GraphClient(getAccessToken));
        try {
          const result = await addPhotoToExistingAlbum({ db, drive }, action.photoId, action.albumId);
          return NextResponse.json(result);
        } catch (error) {
          if (error instanceof AlbumNotFoundError) {
            invalidateAlbumCatalog();
            return NextResponse.json({ error: error.message }, { status: 404 });
          }
          if (isItemNotFound(error)) {
            return NextResponse.json(
              { error: "OneDrive photo or album item no longer exists" },
              { status: 404 },
            );
          }
          throw error;
        }
      }

      if (action.action === "delete") {
        assertText(action.photoId, "photoId");
        const drive = new DriveApi(new GraphClient(getAccessToken));
        const result = await deleteLibraryPhoto({ db, drive, demoMode: env.DEMO_MODE }, action.photoId);
        return NextResponse.json(result);
      }

      throw new Error("Invalid photo action");
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
