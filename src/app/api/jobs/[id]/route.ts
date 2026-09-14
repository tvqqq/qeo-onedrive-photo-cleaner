import { NextResponse } from "next/server";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { getJob } from "@/lib/jobs/repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const db = openAppDatabase();
  try {
    migrateDatabase(db);
    const job = getJob(db, id);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json(job);
  } finally {
    db.close();
  }
}
