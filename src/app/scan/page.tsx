import { JobProgress } from "@/components/job-progress";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function ScanPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 lg:p-8">
      <PageHeader
        eyebrow="OneDrive indexing"
        title="Scan OneDrive Photos"
        description="Incremental scan resumes from the saved Microsoft Graph delta token. Full scan walks the drive again and is the right choice after a schema upgrade or when you want to backfill metadata."
      />

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <h2 className="font-medium text-zinc-100">Incremental scan</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Fast day-to-day refresh using the saved Graph delta cursor. Use this for normal ongoing maintenance.
          </p>
        </div>
        <div>
          <h2 className="font-medium text-zinc-100">Full scan</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Re-indexes the drive from the root and refreshes available Graph metadata. Existing cleanup state remains local.
          </p>
        </div>
      </Card>

      <JobProgress />
    </main>
  );
}
