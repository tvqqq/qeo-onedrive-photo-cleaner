import { join } from "node:path";
import { SettingsControls } from "@/components/settings-controls";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { isMicrosoftConnected } from "@/lib/auth/msal";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { env } from "@/lib/env";
import { getCleanerSettings } from "@/lib/settings/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    <main className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
      <PageHeader
        eyebrow="Local runtime"
        title="Settings"
        description="Manage the OneDrive connection, runtime paths, duplicate thresholds, and disposable thumbnail cache without changing the cleanup safety model."
      />

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-medium text-zinc-400">Microsoft account</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge tone={connected ? "success" : "neutral"}>{connected ? "Connected" : "Not connected"}</Badge>
            {!connected ? <a className={buttonClass("secondary")} href="/api/auth/login">Connect OneDrive</a> : null}
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">Delegated Files.ReadWrite access is stored in the encrypted local token cache.</p>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-medium text-zinc-400">Runtime mode</p>
          <div className="mt-3">
            <Badge tone={env.DEMO_MODE ? "warning" : "success"}>{env.DEMO_MODE ? "Demo mode" : "Live mode"}</Badge>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Demo mode blocks destructive OneDrive mutations while keeping scan and review flows available.
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-medium text-zinc-400">Data directory</p>
          <p className="mt-3 break-all font-mono text-sm text-zinc-100">{env.DATA_DIR}</p>
          <p className="mt-3 text-xs leading-5 text-zinc-500">SQLite state, encrypted auth cache, thumbnails, and local model cache persist here.</p>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-medium text-zinc-400">Local vision model</p>
          <p className="mt-3 text-sm font-medium text-zinc-100">{env.CLIP_MODEL_ID}</p>
          <p className="mt-2 break-all font-mono text-xs text-zinc-400">Cache: {modelCache}</p>
          <p className="mt-3 text-xs leading-5 text-zinc-500">Loaded lazily for local inference. No cloud vision API is used.</p>
        </Card>
      </section>

      <Card className="p-5">
        <SettingsControls
          dhashThreshold={settings.dhashThreshold}
          clipThreshold={settings.clipThreshold}
        />
      </Card>
    </main>
  );
}
