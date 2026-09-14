import type { AppDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { DriveApi } from "@/lib/graph/drive";
import { GraphClient } from "@/lib/graph/client";
import { getAccessToken } from "@/lib/auth/msal";
import type { JobRecord } from "@/lib/jobs/types";
import { DemoDriveApi } from "@/lib/scan/demo";
import { runScanJob, type ScanMode } from "@/lib/scan/service";
import { runExactDuplicateJob } from "@/lib/duplicates/exact";

function driveApi() {
  return env.DEMO_MODE ? new DemoDriveApi() : new DriveApi(new GraphClient(getAccessToken));
}

export async function dispatchJob(db: AppDatabase, job: JobRecord): Promise<void> {
  switch (job.type) {
    case "scan": {
      const payload = (job.payload ?? {}) as { mode?: ScanMode };
      await runScanJob({ db, drive: driveApi() }, job.id, payload.mode ?? "incremental");
      return;
    }
    case "verify-exact":
      await runExactDuplicateJob({ db, drive: driveApi() }, job.id);
      return;
    default:
      throw new Error(`Job type ${job.type} is not implemented yet`);
  }
}
