import { NextResponse } from "next/server";
import { isMicrosoftConnected } from "@/lib/auth/msal";

export async function GET() {
  return NextResponse.json({ connected: await isMicrosoftConnected() });
}
