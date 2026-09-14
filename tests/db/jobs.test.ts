import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { claimNextJob, enqueueJob, getJob, requeueInterruptedJobs } from "@/lib/jobs/repository";

function createTestDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "qeo-photo-db-"));
  const db = createDatabase(join(dir, "test.db"));
  migrateDatabase(db);
  return db;
}

describe("job repository", () => {
  it("claims one queued job atomically and marks it running", () => {
    const db = createTestDatabase();
    const id = enqueueJob(db, "scan", { mode: "full" });

    const claimed = claimNextJob(db);

    expect(claimed?.id).toBe(id);
    expect(claimed?.status).toBe("running");
    expect(claimNextJob(db)).toBeNull();
  });

  it("requeues interrupted running jobs on worker startup", () => {
    const db = createTestDatabase();
    const id = enqueueJob(db, "scan", {});
    claimNextJob(db);

    requeueInterruptedJobs(db);

    expect(getJob(db, id)?.status).toBe("queued");
  });
});
