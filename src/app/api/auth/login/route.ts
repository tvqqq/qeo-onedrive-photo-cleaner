import { NextResponse } from "next/server";
import { buildLoginUrl } from "@/lib/auth/msal";

export async function GET() {
  try {
    return NextResponse.redirect(await buildLoginUrl());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Microsoft login";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
