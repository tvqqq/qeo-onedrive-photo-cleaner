import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSimilarPhotoJob: vi.fn(),
  runTagPhotosJob: vi.fn(),
  embedImage: vi.fn(),
  getCleanerSettings: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { DEMO_MODE: true } }));
vi.mock("@/lib/auth/msal", () => ({ getAccessToken: vi.fn() }));
vi.mock("@/lib/graph/client", () => ({ GraphClient: class {} }));
vi.mock("@/lib/graph/drive", () => ({ DriveApi: class {} }));
vi.mock("@/lib/scan/demo", () => ({ DemoDriveApi: class {} }));
vi.mock("@/lib/scan/service", () => ({ runScanJob: vi.fn() }));
vi.mock("@/lib/duplicates/exact", () => ({ runExactDuplicateJob: vi.fn() }));
vi.mock("@/lib/duplicates/similar", () => ({ runSimilarPhotoJob: mocks.runSimilarPhotoJob }));
vi.mock("@/lib/settings/service", () => ({ getCleanerSettings: mocks.getCleanerSettings }));
vi.mock("@/lib/tags/service", () => ({ runTagPhotosJob: mocks.runTagPhotosJob }));
vi.mock("@/lib/classification/clip", () => ({
  ClipService: class {
    embedImage = mocks.embedImage;
  },
}));

import { dispatchJob } from "@/worker/handlers";
import type { AppDatabase } from "@/lib/db/client";
import type { JobRecord } from "@/lib/jobs/types";

beforeEach(() => {
  mocks.runSimilarPhotoJob.mockReset();
  mocks.runTagPhotosJob.mockReset();
  mocks.getCleanerSettings.mockReset().mockReturnValue({ dhashThreshold: 6, clipThreshold: 0.96 });
});

describe("worker dispatch", () => {
  it("dispatches find-similar jobs with local CLIP and saved thresholds", async () => {
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

    expect(mocks.getCleanerSettings).toHaveBeenCalledWith(db);
    expect(mocks.runSimilarPhotoJob).toHaveBeenCalledTimes(1);
    const [context, jobId, options] = mocks.runSimilarPhotoJob.mock.calls[0]!;
    expect(context.db).toBe(db);
    expect(context.clip).toEqual(expect.objectContaining({ embedImage: expect.any(Function) }));
    expect(jobId).toBe("job-similar");
    expect(options).toEqual({ dHashThreshold: 6, clipThreshold: 0.96 });
  });

  it("dispatches tag-photos jobs with the shared classifier singleton", async () => {
    const db = {} as AppDatabase;
    const first: JobRecord = {
      id: "job-tags-1",
      type: "tag-photos",
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
    const second = { ...first, id: "job-tags-2" } satisfies JobRecord;

    await dispatchJob(db, first);
    await dispatchJob(db, second);

    expect(mocks.runTagPhotosJob).toHaveBeenCalledTimes(2);
    const [firstContext, firstJobId] = mocks.runTagPhotosJob.mock.calls[0]!;
    const [secondContext, secondJobId] = mocks.runTagPhotosJob.mock.calls[1]!;
    expect(firstContext.db).toBe(db);
    expect(firstContext.classifier).toBe(secondContext.classifier);
    expect(firstJobId).toBe("job-tags-1");
    expect(secondJobId).toBe("job-tags-2");
  });
});
