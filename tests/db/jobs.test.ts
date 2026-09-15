import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  claimNextJob,
  enqueueJob,
  enqueueJobIfIdle,
  failJob,
  finishJob,
  getJob,
  requeueInterruptedJobs,
} from "@/lib/jobs/repository";

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

    const claimed = claimNextJob(db, "core");

    expect(claimed?.id).toBe(id);
    expect(claimed?.status).toBe("running");
    expect(claimNextJob(db, "core")).toBeNull();
  });

  it("lets the core lane bypass an older ML job", () => {
    const db = createTestDatabase();
    const classifyId = enqueueJob(db, "classify", {});
    const scanId = enqueueJob(db, "scan", { mode: "full" });

    expect(claimNextJob(db, "core")?.id).toBe(scanId);
    expect(getJob(db, classifyId)?.status).toBe("queued");
  });

  it("lets the ML lane claim only ML jobs", () => {
    const db = createTestDatabase();
    const scanId = enqueueJob(db, "scan", { mode: "full" });
    const similarId = enqueueJob(db, "find-similar", {});

    expect(claimNextJob(db, "ml")?.id).toBe(similarId);
    expect(getJob(db, scanId)?.status).toBe("queued");
  });

  it("assigns tag-photos only to the ML lane", () => {
    const db = createTestDatabase();
    const tagJobId = enqueueJob(db, "tag-photos", {});

    expect(claimNextJob(db, "core")).toBeNull();
    expect(claimNextJob(db, "ml")?.id).toBe(tagJobId);
  });

  it("deduplicates active jobs and creates fresh jobs after terminal states", () => {
    const db = createTestDatabase();
    const first = enqueueJobIfIdle(db, "tag-photos", {});

    expect(enqueueJobIfIdle(db, "tag-photos", {})).toBe(first);

    finishJob(db, first);
    const second = enqueueJobIfIdle(db, "tag-photos", {});
    expect(second).not.toBe(first);
    expect(getJob(db, second)?.status).toBe("queued");

    failJob(db, second, "failed");
    const third = enqueueJobIfIdle(db, "tag-photos", {});
    expect(third).not.toBe(second);
    expect(getJob(db, third)?.status).toBe("queued");
  });

  it("requeues only interrupted jobs owned by the starting lane", () => {
    const db = createTestDatabase();
    const scanId = enqueueJob(db, "scan", {});
    const classifyId = enqueueJob(db, "classify", {});
    claimNextJob(db, "core");
    claimNextJob(db, "ml");

    requeueInterruptedJobs(db, "core");

    expect(getJob(db, scanId)?.status).toBe("queued");
    expect(getJob(db, classifyId)?.status).toBe("running");
  });
});
