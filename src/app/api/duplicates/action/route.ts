import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccessToken } from "@/lib/auth/msal";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { deleteApprovedExactGroup } from "@/lib/duplicates/delete";
import { env } from "@/lib/env";
import { GraphClient } from "@/lib/graph/client";
import { DriveApi } from "@/lib/graph/drive";
import { enqueueJob } from "@/lib/jobs/repository";
import { assertSameOriginJson } from "@/lib/security/request";

export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify-exact") }),
  z.object({ action: z.literal("find-similar") }),
  z.object({
    action: z.literal("delete"),
    groupId: z.string().min(1),
    selectedPhotoIds: z.array(z.string().min(1)).min(1),
  }),
]);

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const action = actionSchema.parse(await request.json());
    const db = openAppDatabase();
    try {
      migrateDatabase(db);
      if (action.action === "verify-exact") {
        const jobId = enqueueJob(db, "verify-exact", {});
        return NextResponse.json({ jobId }, { status: 202 });
      }
      if (action.action === "find-similar") {
        const jobId = enqueueJob(db, "find-similar", {});
        return NextResponse.json({ jobId }, { status: 202 });
      }
      if (env.DEMO_MODE) {
        return NextResponse.json({ error: "Demo mode never deletes OneDrive items" }, { status: 403 });
      }
      const drive = new DriveApi(new GraphClient(getAccessToken));
      const result = await deleteApprovedExactGroup(
        { db, drive },
        action.groupId,
        action.selectedPhotoIds,
      );
      return NextResponse.json(result);
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Duplicate action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
