import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { findPhotoByDriveId, getScanState } from "@/lib/db/repositories";
import { claimNextJob, enqueueJob, getJob } from "@/lib/jobs/repository";
import { isPhotoCandidate, runScanJob } from "@/lib/scan/service";
import type { DeltaPage, GraphDriveItem } from "@/lib/graph/types";

function database() {
  const db = createDatabase(join(mkdtempSync(join(tmpdir(), "qeo-scan-")), "test.db"));
  migrateDatabase(db);
  return db;
}

function item(value: Partial<GraphDriveItem> & Pick<GraphDriveItem, "id">): GraphDriveItem {
  return { name: `${value.id}.jpg`, ...value } as GraphDriveItem;
}

describe("scan service", () => {
  it("recognizes image files but not deleted or non-image items", () => {
    expect(isPhotoCandidate(item({ id: "a", file: { mimeType: "image/jpeg" } }))).toBe(true);
    expect(isPhotoCandidate(item({ id: "b", file: { mimeType: "application/pdf" } }))).toBe(false);
    expect(isPhotoCandidate(item({ id: "c", deleted: { state: "deleted" }, file: { mimeType: "image/jpeg" } }))).toBe(false);
  });

  it("keeps the last delta occurrence and reconciles remote deletions", async () => {
    const db = database();
    const jobId = enqueueJob(db, "scan", { mode: "incremental" });
    claimNextJob(db);
    const page: DeltaPage = {
      items: [
        item({ id: "folder", name: "Photos", folder: {} }),
        item({ id: "photo-1", name: "old.jpg", parentReference: { id: "folder" }, size: 10, eTag: "v1", file: { mimeType: "image/jpeg", hashes: { quickXorHash: "q1" } }, photo: { width: 100, height: 80 } }),
        item({ id: "shot-1", name: "shot.png", size: 20, file: { mimeType: "image/png" } }),
        item({ id: "pdf-1", name: "doc.pdf", file: { mimeType: "application/pdf" } }),
        item({ id: "deleted-1", name: "gone.jpg", size: 30, file: { mimeType: "image/jpeg" } }),
        item({ id: "photo-1", name: "renamed.jpg", parentReference: { id: "folder" }, size: 10, eTag: "v2", file: { mimeType: "image/jpeg", hashes: { quickXorHash: "q1" } } }),
        { id: "deleted-1", deleted: { state: "deleted" } } as GraphDriveItem,
      ],
      deltaLink: "https://graph.microsoft.com/v1.0/me/drive/root/delta?token=done",
    };
    const drive = { getDeltaPage: vi.fn().mockResolvedValue(page) };

    await runScanJob({ db, drive }, jobId, "incremental");

    expect(findPhotoByDriveId(db, "photo-1")?.name).toBe("renamed.jpg");
    expect(findPhotoByDriveId(db, "shot-1")?.mimeType).toBe("image/png");
    expect(findPhotoByDriveId(db, "pdf-1")).toBeNull();
    expect(findPhotoByDriveId(db, "deleted-1")?.deletedRemoteAt).not.toBeNull();
    expect(getScanState(db, "deltaLink")).toBe(page.deltaLink);
  });

  it("checkpoints nextLink and committed photos before a later page fails", async () => {
    const db = database();
    const jobId = enqueueJob(db, "scan", { mode: "incremental" });
    claimNextJob(db);
    const nextLink = "https://graph.microsoft.com/v1.0/me/drive/root/delta?token=next";
    const drive = {
      getDeltaPage: vi
        .fn()
        .mockResolvedValueOnce({ items: [item({ id: "page-1", file: { mimeType: "image/jpeg" } })], nextLink })
        .mockRejectedValueOnce(new Error("network down")),
    };

    await expect(runScanJob({ db, drive }, jobId, "incremental")).rejects.toThrow("network down");

    expect(findPhotoByDriveId(db, "page-1")).not.toBeNull();
    expect((getJob(db, jobId)?.payload as { nextLink?: string }).nextLink).toBe(nextLink);
  });
});
