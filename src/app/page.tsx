import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { buttonClass } from "@/components/ui/button";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { getDashboardMetrics } from "@/lib/db/repositories";
import { formatBytes } from "@/lib/photos/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    <main className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
      <PageHeader
        eyebrow="Local-first OneDrive maintenance"
        title="Qeo OneDrive Photo Cleaner"
        description="Original photos stay in OneDrive. Destructive actions remain review-gated, while metadata, thumbnails, and cleanup state stay local."
        actions={(
          <>
            <Link className={buttonClass("primary")} href="/scan">Scan now</Link>
            <Link className={buttonClass("secondary")} href="/photos">Browse photos</Link>
            <Link className={buttonClass("secondary")} href="/duplicates">Review duplicates</Link>
          </>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Primary cleanup metrics">
        <StatCard label="Indexed photos" value={metrics.photoCount.toLocaleString()} hint="Active photos currently indexed locally." />
        <StatCard label="Indexed size" value={formatBytes(metrics.totalBytes)} hint="Total size represented by the local index." />
        <StatCard label="Exact groups to review" value={metrics.pendingExactGroups.toLocaleString()} hint="SHA-256 verified groups still awaiting review." />
        <StatCard label="Potential reclaim" value={formatBytes(metrics.reclaimableBytes)} hint="Estimated bytes from reviewed exact-duplicate candidates." />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Secondary cleanup metrics">
        <StatCard label="Similar groups" value={metrics.pendingSimilarGroups.toLocaleString()} hint="Heuristic matches remain review-only." />
        <StatCard label="Unreviewed classifications" value={metrics.unreviewedCategories.toLocaleString()} hint="Local category suggestions waiting for review." />
        <StatCard label="Active job" value={metrics.activeJob?.status ?? "Idle"} hint="Current background worker state." />
        <StatCard label="Processed in active job" value={(metrics.activeJob?.progressCurrent ?? 0).toLocaleString()} hint="Items processed by the active scan or analysis job." />
      </section>
    </main>
  );
}
