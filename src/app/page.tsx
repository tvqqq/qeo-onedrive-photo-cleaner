import Link from "next/link";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { getDashboardMetrics } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const db = openAppDatabase();
  let metrics;
  try {
    migrateDatabase(db);
    metrics = getDashboardMetrics(db);
  } finally {
    db.close();
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Local-first OneDrive maintenance</p>
        <h1 className="mt-1 text-3xl font-semibold">Qeo OneDrive Photo Cleaner</h1>
        <p className="mt-2 text-gray-600">Original photos stay in OneDrive. Destructive actions always require review.</p>
      </div>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="rounded-md border px-3 py-2" href="/scan">Scan</Link>
        <Link className="rounded-md border px-3 py-2" href="/duplicates">Duplicates</Link>
        <Link className="rounded-md border px-3 py-2" href="/categories">Categories</Link>
        <Link className="rounded-md border px-3 py-2" href="/settings">Settings</Link>
      </nav>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Indexed photos" value={metrics.photoCount.toLocaleString()} />
        <Metric label="Indexed size" value={formatBytes(metrics.totalBytes)} />
        <Metric label="Exact groups to review" value={metrics.pendingExactGroups} />
        <Metric label="Potential reclaim" value={formatBytes(metrics.reclaimableBytes)} />
        <Metric label="Similar groups" value={metrics.pendingSimilarGroups} />
        <Metric label="Unreviewed classifications" value={metrics.unreviewedCategories} />
        <Metric label="Active job" value={metrics.activeJob?.status ?? "Idle"} />
        <Metric label="Processed in active job" value={metrics.activeJob?.progressCurrent ?? 0} />
      </section>
    </main>
  );
}
