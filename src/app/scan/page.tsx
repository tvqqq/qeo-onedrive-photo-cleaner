import Link from "next/link";
import { JobProgress } from "@/components/job-progress";

export default function ScanPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <Link className="text-sm underline" href="/">← Dashboard</Link>
        <h1 className="mt-4 text-2xl font-semibold">Scan OneDrive Photos</h1>
        <p className="mt-2 text-sm text-gray-600">
          Incremental scan resumes from the saved Graph delta token. Full scan starts from the drive root.
        </p>
      </div>
      <JobProgress />
    </main>
  );
}
