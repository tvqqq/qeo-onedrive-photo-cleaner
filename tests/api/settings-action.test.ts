import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { close: vi.fn() },
  updateCleanerSettings: vi.fn(),
  clearThumbnailCache: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ openAppDatabase: () => mocks.db }));
vi.mock("@/lib/db/migrate", () => ({ migrateDatabase: vi.fn() }));
vi.mock("@/lib/settings/service", () => ({ updateCleanerSettings: mocks.updateCleanerSettings }));
vi.mock("@/lib/thumbnails/cache", () => ({ clearThumbnailCache: mocks.clearThumbnailCache }));

import { POST } from "@/app/api/settings/action/route";

beforeEach(() => {
  mocks.db.close.mockReset();
  mocks.updateCleanerSettings.mockReset();
  mocks.clearThumbnailCache.mockReset().mockResolvedValue({ removedFiles: 7 });
});

function request(body: unknown) {
  return new Request("http://localhost:3000/api/settings/action", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("settings actions", () => {
  it("persists duplicate thresholds", async () => {
    const response = await POST(request({
      action: "update-thresholds",
      dhashThreshold: 6,
      clipThreshold: 0.96,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.updateCleanerSettings).toHaveBeenCalledWith(mocks.db, {
      dhashThreshold: 6,
      clipThreshold: 0.96,
    });
  });

  it("clears only the thumbnail cache", async () => {
    const response = await POST(request({ action: "clear-thumbnails" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ removedFiles: 7 });
    expect(mocks.clearThumbnailCache).toHaveBeenCalledOnce();
  });
});
