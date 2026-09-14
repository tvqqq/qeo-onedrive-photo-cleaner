import { NextResponse } from "next/server";
import { z } from "zod";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { enqueueJob } from "@/lib/jobs/repository";
import { assertSameOriginJson } from "@/lib/security/request";

export const runtime = "nodejs";

const schema = z.object({ mode: z.enum(["full", "incremental"]).default("incremental") });

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const body = schema.parse(await request.json());
    const db = openAppDatabase();
    try {
      migrateDatabase(db);
      const jobId = enqueueJob(db, "scan", { mode: body.mode });
      return NextResponse.json({ jobId }, { status: 202 });
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start scan";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
