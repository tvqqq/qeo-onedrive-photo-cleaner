import { constants } from "node:fs";
import { access, chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { ICachePlugin, TokenCacheContext } from "@azure/msal-node";
import { decryptJson, encryptJson } from "./crypto";
import { env } from "@/lib/env";

async function exists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function getOrCreateEncryptionKey(dataDir = env.DATA_DIR): Promise<Buffer> {
  const authDir = join(dataDir, "auth");
  const keyPath = join(authDir, "app.key");
  await mkdir(authDir, { recursive: true, mode: 0o700 });

  if (await exists(keyPath)) return readFile(keyPath);

  const key = randomBytes(32);
  try {
    await writeFile(keyPath, key, { flag: "wx", mode: 0o600 });
    await chmod(keyPath, 0o600);
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return readFile(keyPath);
  }
}

export async function createEncryptedCachePlugin(dataDir = env.DATA_DIR): Promise<ICachePlugin> {
  const authDir = join(dataDir, "auth");
  const cachePath = join(authDir, "msal-cache.enc");
  const key = await getOrCreateEncryptionKey(dataDir);

  return {
    async beforeCacheAccess(context: TokenCacheContext) {
      if (!(await exists(cachePath))) return;
      const payload = await readFile(cachePath, "utf8");
      const serialized = decryptJson<string>(payload, key);
      context.tokenCache.deserialize(serialized);
    },
    async afterCacheAccess(context: TokenCacheContext) {
      if (!context.cacheHasChanged) return;
      await mkdir(authDir, { recursive: true, mode: 0o700 });
      const tmpPath = `${cachePath}.tmp`;
      const payload = encryptJson(context.tokenCache.serialize(), key);
      await writeFile(tmpPath, payload, { mode: 0o600 });
      await rename(tmpPath, cachePath);
      await chmod(cachePath, 0o600);
    },
  };
}

export interface PendingAuth {
  state: string;
  verifier: string;
  createdAt: number;
}

export async function savePendingAuth(value: PendingAuth, dataDir = env.DATA_DIR): Promise<void> {
  const authDir = join(dataDir, "auth");
  await mkdir(authDir, { recursive: true, mode: 0o700 });
  const key = await getOrCreateEncryptionKey(dataDir);
  await writeFile(join(authDir, "pkce.enc"), encryptJson(value, key), { mode: 0o600 });
}

export async function loadPendingAuth(dataDir = env.DATA_DIR): Promise<PendingAuth | null> {
  const path = join(dataDir, "auth", "pkce.enc");
  if (!(await exists(path))) return null;
  const key = await getOrCreateEncryptionKey(dataDir);
  return decryptJson<PendingAuth>(await readFile(path, "utf8"), key);
}

export async function clearPendingAuth(dataDir = env.DATA_DIR): Promise<void> {
  try {
    await unlink(join(dataDir, "auth", "pkce.enc"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
