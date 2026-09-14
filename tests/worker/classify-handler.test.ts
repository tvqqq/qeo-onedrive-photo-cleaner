import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runClassificationJob: vi.fn(), classify: vi.fn() }));

vi.mock("@/lib/env", () => ({ env: { DEMO_MODE: true } }));
vi.mock("@/lib/auth/msal", () => ({ getAccessToken: vi.fn() }));
vi.mock("@/lib/graph/client", () => ({ GraphClient: class {} }));
vi.mock("@/lib/graph/drive", () => ({ DriveApi: class {} }));
vi.mock("@/lib/scan/demo", () => ({ DemoDriveApi: class {} }));
vi.mock("@/lib/scan/service", () => ({ runScanJob: vi.fn() }));
vi.mock("@/lib/duplicates/exact", () => ({ runExactDuplicateJob: vi.fn() }));
vi.mock("@/lib/duplicates/similar", () => ({ runSimilarPhotoJob: vi.fn() }));
vi.mock("@/lib/classification/service", () => ({ runClassificationJob: mocks.runClassificationJob }));
vi.mock("@/lib/classification/clip", () => ({ ClipService: class {} }));
vi.mock("@/lib/classification/classifier", () => ({ ZeroShotClassifier: class { classify = mocks.classify; } }));

import { dispatchJob } from "@/worker/handlers";
import type { AppDatabase } from "@/lib/db/client";
import type { JobRecord } from "@/lib/jobs/types";

describe("classify worker dispatch", () => {
  it("dispatches classify jobs with a local classifier", async () => {
    const db = {} as AppDatabase;
    const job = {
      id: "job-classify",
      type: "classify",
      status: "running",
      payload: {},
      progressCurrent: 0,
      progressTotal: null,
      error: null,
      createdAt: 1,
      startedAt: 2,
      finishedAt: null,
      updatedAt: 2,
    } satisfies JobRecord;

    await dispatchJob(db, job);

    expect(mocks.runClassificationJob).toHaveBeenCalledTimes(1);
    const [context, jobId] = mocks.runClassificationJob.mock.calls[0]!;
    expect(context.db).toBe(db);
    expect(context.classifier).toEqual(expect.objectContaining({ classify: expect.any(Function) }));
    expect(jobId).toBe("job-classify");
  });
});
