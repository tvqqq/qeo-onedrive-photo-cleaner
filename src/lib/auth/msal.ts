import { randomBytes } from "node:crypto";
import {
  LogLevel,
  PublicClientApplication,
  type AuthenticationResult,
  type PublicClientApplication as PublicClientApplicationType,
} from "@azure/msal-node";
import { env } from "@/lib/env";
import { createPkcePair } from "./pkce";
import {
  clearPendingAuth,
  createEncryptedCachePlugin,
  loadPendingAuth,
  savePendingAuth,
} from "./token-cache";

const AUTHORITY = "https://login.microsoftonline.com/consumers";
const SCOPES = ["openid", "profile", "offline_access", "Files.ReadWrite"];
const GRAPH_SCOPES = ["Files.ReadWrite"];
const CALLBACK_PATH = "/api/auth/callback";
const MAX_PENDING_AGE_MS = 10 * 60 * 1000;

async function createClient(): Promise<PublicClientApplicationType> {
  if (!env.MICROSOFT_APP_ID) {
    throw new Error("MICROSOFT_APP_ID is required to connect OneDrive");
  }
  const cachePlugin = await createEncryptedCachePlugin();
  return new PublicClientApplication({
    auth: { clientId: env.MICROSOFT_APP_ID, authority: AUTHORITY },
    cache: { cachePlugin },
    system: {
      loggerOptions: {
        piiLoggingEnabled: false,
        logLevel: LogLevel.Error,
        loggerCallback: () => undefined,
      },
    },
  });
}

function redirectUri() {
  return new URL(CALLBACK_PATH, env.APP_BASE_URL).toString();
}

export async function buildLoginUrl(): Promise<string> {
  const client = await createClient();
  const pkce = createPkcePair();
  const state = randomBytes(24).toString("base64url");
  await savePendingAuth({ state, verifier: pkce.verifier, createdAt: Date.now() });
  return client.getAuthCodeUrl({
    scopes: SCOPES,
    redirectUri: redirectUri(),
    codeChallenge: pkce.challenge,
    codeChallengeMethod: "S256",
    state,
    prompt: "select_account",
  });
}

export async function redeemAuthorizationCode(code: string, state: string): Promise<AuthenticationResult> {
  const pending = await loadPendingAuth();
  if (!pending || pending.state !== state) throw new Error("Invalid OAuth state");
  if (Date.now() - pending.createdAt > MAX_PENDING_AGE_MS) {
    await clearPendingAuth();
    throw new Error("OAuth state expired");
  }

  const client = await createClient();
  try {
    return await client.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: redirectUri(),
      codeVerifier: pending.verifier,
    });
  } finally {
    await clearPendingAuth();
  }
}

export async function getAccessToken(): Promise<string> {
  const client = await createClient();
  const accounts = await client.getTokenCache().getAllAccounts();
  const account = accounts[0];
  if (!account) throw new Error("Microsoft account is not connected");
  const result = await client.acquireTokenSilent({ account, scopes: GRAPH_SCOPES });
  return result.accessToken;
}

export async function isMicrosoftConnected(): Promise<boolean> {
  if (!env.MICROSOFT_APP_ID) return false;
  const client = await createClient();
  return (await client.getTokenCache().getAllAccounts()).length > 0;
}
