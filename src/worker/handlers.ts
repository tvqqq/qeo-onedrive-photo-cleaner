import type { AppDatabase } from "@/lib/db/client";
import { ZeroShotClassifier } from "@/lib/classification/classifier";
import { ClipService } from "@/lib/classification/clip";
import { runClassificationJob } from "@/lib/classification/service";
import { runExactDuplicateJob } from "@/lib/duplicates/exact";
import { runSimilarPhotoJob } from "@/lib/duplicates/similar";
import { env } from "@/lib/env";
import { DriveApi } from "@/lib/graph/drive";
import { GraphClient } from "@/lib/graph/client";
import { getAccessToken } from "@/lib/auth/msal";
import type { JobRecord } from "@/lib/jobs/types";
import { DemoDriveApi } from "@/lib/scan/demo";
import { runScanJob, type ScanMode } from "@/lib/scan/service";
import { getCleanerSettings } from "@/lib/settings/service";
import { runTagPhotosJob } from "@/lib/tags/service";

const clipService = new ClipService();
const zeroShotClassifier = new ZeroShotClassifier();

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
    case "find-similar": {
      const settings = getCleanerSettings(db);
      await runSimilarPhotoJob(
        { db, drive: driveApi(), clip: clipService },
        job.id,
        {
          dHashThreshold: settings.dhashThreshold,
          clipThreshold: settings.clipThreshold,
        },
      );
      return;
    }
    case "classify":
      await runClassificationJob({ db, drive: driveApi(), classifier: zeroShotClassifier }, job.id);
      return;
    case "tag-photos":
      await runTagPhotosJob({ db, drive: driveApi(), classifier: zeroShotClassifier }, job.id);
      return;
    default:
      throw new Error(`Job type ${job.type} is not implemented yet`);
  }
}
