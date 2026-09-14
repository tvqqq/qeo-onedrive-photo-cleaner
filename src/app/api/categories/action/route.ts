import { NextResponse } from "next/server";
import { applyManualReview } from "@/lib/classification/service";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { enqueueJob } from "@/lib/jobs/repository";
import { assertSameOriginJson } from "@/lib/security/request";

export const runtime = "nodejs";

type CategoryAction =
  | { action: "classify" }
  | { action: "review"; photoId: string; add?: string[]; remove?: string[]; markReviewed?: boolean };

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
