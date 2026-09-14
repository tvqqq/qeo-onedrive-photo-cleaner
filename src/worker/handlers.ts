import type { AppDatabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { DriveApi } from "@/lib/graph/drive";
import { GraphClient } from "@/lib/graph/client";
import { getAccessToken } from "@/lib/auth/msal";
import type { JobRecord } from "@/lib/jobs/types";
import { DemoDriveApi } from "@/lib/scan/demo";
import { runScanJob, type ScanMode } from "@/lib/scan/service";

export async function dispatchJob(db: AppDatabase, job: JobRecord): Promise<void> {
  switch (job.type) {
    case "scan": {
      const payload = (job.payload ?? {}) as { mode?: ScanMode };
      const mode = payload.mode ?? "incremental";
      const drive = env.DEMO_MODE
        ? new DemoDriveApi()
        : new DriveApi(new GraphClient(getAccessToken));
      await runScanJob({ db, drive }, job.id, mode);
      return;
    }
    default:
      throw new Error(`Job type ${job.type} is not implemented yet`);
  }
}
