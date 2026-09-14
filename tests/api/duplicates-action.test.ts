import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueJob: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ openAppDatabase: () => ({ close: mocks.close }) }));
vi.mock("@/lib/db/migrate", () => ({ migrateDatabase: vi.fn() }));
vi.mock("@/lib/jobs/repository", () => ({ enqueueJob: mocks.enqueueJob }));
vi.mock("@/lib/auth/msal", () => ({ getAccessToken: vi.fn() }));
vi.mock("@/lib/graph/client", () => ({ GraphClient: class {} }));
vi.mock("@/lib/graph/drive", () => ({ DriveApi: class {} }));
vi.mock("@/lib/duplicates/delete", () => ({ deleteApprovedExactGroup: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { DEMO_MODE: true } }));

import { POST } from "@/app/api/duplicates/action/route";

beforeEach(() => {
  mocks.enqueueJob.mockReset();
  mocks.close.mockReset();
  mocks.enqueueJob.mockReturnValue("job-similar");
});

describe("duplicate actions", () => {
  it("enqueues similar-photo detection", async () => {
    const response = await POST(new Request("http://localhost:3000/api/duplicates/action", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "find-similar" }),
    }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ jobId: "job-similar" });
    expect(mocks.enqueueJob).toHaveBeenCalledWith(expect.anything(), "find-similar", {});
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
