import { NextResponse } from "next/server";
import { redeemAuthorizationCode } from "@/lib/auth/msal";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return NextResponse.json({ error: oauthError }, { status: 400 });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json({ error: "Missing OAuth code or state" }, { status: 400 });
  }

  try {
    await redeemAuthorizationCode(code, state);
    return NextResponse.redirect(new URL("/settings?connected=1", env.APP_BASE_URL));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Microsoft login failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
