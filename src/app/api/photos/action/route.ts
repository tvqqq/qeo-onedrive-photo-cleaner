import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidateAlbumCatalog } from "@/lib/albums/catalog";
import { addPhotoToExistingAlbum, AlbumNotFoundError } from "@/lib/albums/library";
import { getAccessToken } from "@/lib/auth/msal";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { getPhotoById } from "@/lib/db/repositories";
import { env } from "@/lib/env";
import { GraphClient, GraphRequestError } from "@/lib/graph/client";
import { DriveApi } from "@/lib/graph/drive";
import { enqueueJobIfIdle } from "@/lib/jobs/repository";
import { deleteLibraryPhoto } from "@/lib/photos/delete";
import { redactError } from "@/lib/security/redact";
import { assertSameOriginJson } from "@/lib/security/request";
import { applyManualTag } from "@/lib/tags/repository";

export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate-tags") }),
  z.object({
    action: z.literal("add-tag"),
    photoId: z.string().min(1),
    tag: z.string().min(1).max(80),
  }),
  z.object({
    action: z.literal("remove-tag"),
    photoId: z.string().min(1),
    tag: z.string().min(1).max(80),
  }),
  z.object({
    action: z.literal("add-to-album"),
    photoId: z.string().min(1),
    albumId: z.string().min(1),
  }),
  z.object({
    action: z.literal("delete"),
    photoId: z.string().min(1),
  }),
]);

function isItemNotFound(error: unknown): error is GraphRequestError {
  return error instanceof GraphRequestError &&
    error.status === 404 &&
    (error.code === null || error.code.toLowerCase() === "itemnotfound");
}

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const rawAction: unknown = await request.json();
    const db = openAppDatabase();
    try {
      migrateDatabase(db);
      const action = actionSchema.parse(rawAction);

      if (action.action === "generate-tags") {
        const jobId = enqueueJobIfIdle(db, "tag-photos", {});
        return NextResponse.json({ jobId }, { status: 202 });
      }

      if (action.action === "add-tag" || action.action === "remove-tag") {
        const photo = getPhotoById(db, action.photoId);
        if (!photo || photo.deletedRemoteAt !== null) throw new Error("Photo is not available");
        const tag = applyManualTag(
          db,
          action.photoId,
          action.tag,
          action.action === "add-tag" ? "active" : "removed",
        );
        return NextResponse.json({ tag });
      }

      if (action.action === "add-to-album") {
        if (env.DEMO_MODE) {
          return NextResponse.json(
            { error: "Demo mode never changes OneDrive albums" },
            { status: 403 },
          );
        }
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

      const drive = new DriveApi(new GraphClient(getAccessToken));
      const result = await deleteLibraryPhoto({ db, drive, demoMode: env.DEMO_MODE }, action.photoId);
      return NextResponse.json(result);
    } finally {
      db.close();
    }
  } catch (error) {
    return NextResponse.json({ error: redactError(error) }, { status: 400 });
  }
}
