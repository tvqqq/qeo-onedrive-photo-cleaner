import { NextResponse } from "next/server";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { updateCleanerSettings } from "@/lib/settings/service";
import { assertSameOriginJson } from "@/lib/security/request";
import { clearThumbnailCache } from "@/lib/thumbnails/cache";

export const runtime = "nodejs";

type SettingsAction =
  | { action: "update-thresholds"; dhashThreshold: number; clipThreshold: number }
  | { action: "clear-thumbnails" };

export async function POST(request: Request) {
  try {
    assertSameOriginJson(request);
    const action = await request.json() as SettingsAction;

    if (action.action === "clear-thumbnails") {
      return NextResponse.json(await clearThumbnailCache());
    }

    if (action.action !== "update-thresholds") throw new Error("Invalid settings action");
    const db = openAppDatabase();
    try {
      migrateDatabase(db);
      updateCleanerSettings(db, {
        dhashThreshold: action.dhashThreshold,
        clipThreshold: action.clipThreshold,
      });
      return NextResponse.json({ ok: true });
    } finally {
      db.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Settings action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
