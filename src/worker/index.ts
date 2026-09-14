import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  claimNextJob,
  failJob,
  finishJob,
  requeueInterruptedJobs,
} from "@/lib/jobs/repository";
import { redactError } from "@/lib/security/redact";
import { dispatchJob } from "./handlers";

const db = openAppDatabase();
migrateDatabase(db);
requeueInterruptedJobs(db);

let running = true;
process.once("SIGTERM", () => { running = false; });
process.once("SIGINT", () => { running = false; });

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

try {
  while (running) {
    const job = claimNextJob(db);
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
