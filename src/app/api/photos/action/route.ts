import { NextResponse } from "next/server";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { enqueueJobIfIdle } from "@/lib/jobs/repository";
import { assertSameOriginJson } from "@/lib/security/request";
import { applyManualTag } from "@/lib/tags/repository";

export const runtime = "nodejs";

type PhotoAction =
  | { action: "generate-tags" }
  | { action: "add-tag"; photoId: string; tag: string }
  | { action: "remove-tag"; photoId: string; tag: string };

function assertText(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
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

      throw new Error("Invalid photo action");
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
