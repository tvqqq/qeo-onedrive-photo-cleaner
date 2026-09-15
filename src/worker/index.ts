import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { env } from "@/lib/env";
import {
  claimNextJob,
  failJob,
  finishJob,
  requeueInterruptedJobs,
} from "@/lib/jobs/repository";
import { redactError } from "@/lib/security/redact";
import { dispatchJob } from "./handlers";

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const db = openAppDatabase();
  migrateDatabase(db);
  requeueInterruptedJobs(db, env.WORKER_LANE);

  let running = true;
  process.once("SIGTERM", () => { running = false; });
  process.once("SIGINT", () => { running = false; });

  try {
    while (running) {
      const job = claimNextJob(db, env.WORKER_LANE);
      if (!job) {
        await sleep(1000);
        continue;
      }
      try {
        await dispatchJob(db, job);
        finishJob(db, job.id);
      } catch (error) {
        failJob(db, job.id, redactError(error));
      }
    }
  } finally {
    db.close();
  }
}

void main().catch((error) => {
  console.error(redactError(error));
  process.exitCode = 1;
});
