import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSimilarPhotoJob: vi.fn(),
  embedImage: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { DEMO_MODE: true } }));
vi.mock("@/lib/auth/msal", () => ({ getAccessToken: vi.fn() }));
vi.mock("@/lib/graph/client", () => ({ GraphClient: class {} }));
vi.mock("@/lib/graph/drive", () => ({ DriveApi: class {} }));
vi.mock("@/lib/scan/demo", () => ({ DemoDriveApi: class {} }));
vi.mock("@/lib/scan/service", () => ({ runScanJob: vi.fn() }));
vi.mock("@/lib/duplicates/exact", () => ({ runExactDuplicateJob: vi.fn() }));
vi.mock("@/lib/duplicates/similar", () => ({ runSimilarPhotoJob: mocks.runSimilarPhotoJob }));
vi.mock("@/lib/classification/clip", () => ({
  ClipService: class {
    embedImage = mocks.embedImage;
  },
}));

import { dispatchJob } from "@/worker/handlers";
import type { AppDatabase } from "@/lib/db/client";
import type { JobRecord } from "@/lib/jobs/types";

beforeEach(() => mocks.runSimilarPhotoJob.mockReset());

describe("worker dispatch", () => {
  it("dispatches find-similar jobs with a local CLIP service", async () => {
    const db = {} as AppDatabase;
    const job: JobRecord = {
      id: "job-similar",
      type: "find-similar",
      status: "running",
      payload: {},
      progressCurrent: 0,
      progressTotal: null,
      error: null,
      createdAt: 1,
      startedAt: 2,
      finishedAt: null,
      updatedAt: 2,
    };

    await dispatchJob(db, job);

    expect(mocks.runSimilarPhotoJob).toHaveBeenCalledTimes(1);
    const [context, jobId] = mocks.runSimilarPhotoJob.mock.calls[0]!;
    expect(context.db).toBe(db);
    expect(context.clip).toEqual(expect.objectContaining({ embedImage: expect.any(Function) }));
    expect(jobId).toBe("job-similar");
  });
});
