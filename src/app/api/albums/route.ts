import { NextResponse } from "next/server";
import { listAlbumsCached } from "@/lib/albums/catalog";
import { getAccessToken } from "@/lib/auth/msal";
import { env } from "@/lib/env";
import { GraphClient } from "@/lib/graph/client";
import { DriveApi } from "@/lib/graph/drive";
import { redactError } from "@/lib/security/redact";

export const runtime = "nodejs";

export async function GET() {
  if (env.DEMO_MODE) return NextResponse.json({ albums: [] });

  try {
    const drive = new DriveApi(new GraphClient(getAccessToken));
    const albums = await listAlbumsCached(drive);
    return NextResponse.json({ albums });
  } catch (error) {
    return NextResponse.json({ error: redactError(error) }, { status: 502 });
  }
}
