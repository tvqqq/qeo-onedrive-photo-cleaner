import { NextResponse } from "next/server";
import { syncCategoryAlbum } from "@/lib/albums/service";
import { getAccessToken } from "@/lib/auth/msal";
import { applyManualReview } from "@/lib/classification/service";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { env } from "@/lib/env";
import { GraphClient } from "@/lib/graph/client";
import { DriveApi } from "@/lib/graph/drive";
import { enqueueJob } from "@/lib/jobs/repository";
import { assertSameOriginJson } from "@/lib/security/request";

export const runtime = "nodejs";

type CategoryAction =
  | { action: "classify" }
  | { action: "review"; photoId: string; add?: string[]; remove?: string[]; markReviewed?: boolean }
  | { action: "sync-album"; categoryId: string };

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const action = await request.json() as CategoryAction;
    const db = openAppDatabase();
    try {
      migrateDatabase(db);
      if (action.action === "classify") {
        const jobId = enqueueJob(db, "classify", {});
        return NextResponse.json({ jobId }, { status: 202 });
      }
      if (action.action === "sync-album") {
        if (!action.categoryId) throw new Error("Category is required");
        if (env.DEMO_MODE) {
          return NextResponse.json({ error: "Demo mode never changes OneDrive albums" }, { status: 403 });
        }
        const drive = new DriveApi(new GraphClient(getAccessToken));
        const result = await syncCategoryAlbum({ db, drive }, action.categoryId);
        return NextResponse.json(result);
      }
      if (action.action !== "review" || !action.photoId) throw new Error("Invalid category action");
      applyManualReview(db, action.photoId, {
        add: action.add ?? [],
        remove: action.remove ?? [],
        markReviewed: action.markReviewed ?? true,
      });
      return NextResponse.json({ ok: true });
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Category action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
