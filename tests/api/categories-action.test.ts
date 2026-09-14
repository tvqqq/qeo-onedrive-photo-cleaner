import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { close: vi.fn() },
  enqueueJob: vi.fn(),
  applyManualReview: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ openAppDatabase: () => mocks.db }));
vi.mock("@/lib/db/migrate", () => ({ migrateDatabase: vi.fn() }));
vi.mock("@/lib/jobs/repository", () => ({ enqueueJob: mocks.enqueueJob }));
vi.mock("@/lib/classification/service", () => ({ applyManualReview: mocks.applyManualReview }));

import { POST } from "@/app/api/categories/action/route";

beforeEach(() => {
  mocks.db.close.mockReset();
  mocks.enqueueJob.mockReset().mockReturnValue("job-classify");
  mocks.applyManualReview.mockReset();
});

function request(body: unknown) {
  return new Request("http://localhost:3000/api/categories/action", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("category actions", () => {
  it("enqueues local classification", async () => {
    const response = await POST(request({ action: "classify" }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ jobId: "job-classify" });
    expect(mocks.enqueueJob).toHaveBeenCalledWith(mocks.db, "classify", {});
  });

  it("saves manual overrides and marks a photo reviewed", async () => {
    const response = await POST(request({
      action: "review",
      photoId: "photo-1",
      add: ["family"],
      remove: ["travel"],
      markReviewed: true,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.applyManualReview).toHaveBeenCalledWith(mocks.db, "photo-1", {
      add: ["family"],
      remove: ["travel"],
      markReviewed: true,
    });
  });
});
