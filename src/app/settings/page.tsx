import Link from "next/link";
import { join } from "node:path";
import { SettingsControls } from "@/components/settings-controls";
import { isMicrosoftConnected } from "@/lib/auth/msal";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { env } from "@/lib/env";
import { getCleanerSettings } from "@/lib/settings/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function StatusBadge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${ok ? "bg-green-100 text-green-900" : "bg-gray-100 text-gray-700"}`}>
      {children}
    </span>
  );
}

export default async function SettingsPage() {
  const db = openAppDatabase();
  let settings;
  try {
    migrateDatabase(db);
    settings = getCleanerSettings(db);
  } finally {
    db.close();
  }

  let connected = false;
  try {
    connected = await isMicrosoftConnected();
  } catch {
    connected = false;
  }

  const modelCache = join(env.DATA_DIR, "models");

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <div>
        <Link className="text-sm underline" href="/">← Dashboard</Link>
        <h1 className="mt-4 text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Local runtime, OneDrive connection, duplicate thresholds, and cache controls.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Microsoft account</p>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge ok={connected}>{connected ? "Connected" : "Not connected"}</StatusBadge>
            {!connected ? <a className="text-sm underline" href="/api/auth/login">Connect OneDrive</a> : null}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Runtime mode</p>
          <div className="mt-2">
            <StatusBadge ok={!env.DEMO_MODE}>{env.DEMO_MODE ? "Demo mode" : "Live mode"}</StatusBadge>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Data directory</p>
          <p className="mt-2 break-all font-mono text-sm">{env.DATA_DIR}</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Local vision model</p>
          <p className="mt-2 text-sm font-medium">{env.CLIP_MODEL_ID}</p>
          <p className="mt-1 break-all font-mono text-xs text-gray-500">Cache: {modelCache}</p>
          <p className="mt-2 text-xs text-gray-500">Loaded lazily on first local inference. No cloud vision API is used.</p>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <div>
          <h2 className="font-medium">Duplicate detection</h2>
          <p className="mt-1 text-sm text-gray-600">
            Defaults are conservative: dHash 8 and CLIP cosine 0.94. Similar matches remain review-only.
          </p>
        </div>
        <SettingsControls
          dhashThreshold={settings.dhashThreshold}
          clipThreshold={settings.clipThreshold}
        />
      </section>
    </main>
  );
}
