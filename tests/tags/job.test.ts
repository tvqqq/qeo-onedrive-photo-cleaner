import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { env } from "@/lib/env";
import { GraphRequestError } from "@/lib/graph/client";
import { enqueueJob, getJob } from "@/lib/jobs/repository";
import { listActiveTagsForPhoto, replaceAiTagsForPhoto } from "@/lib/tags/repository";
import { runTagPhotosJob, selectAiTagSuggestions } from "@/lib/tags/service";
import { TAG_TAXONOMY_VERSION } from "@/lib/tags/vocabulary";

const open: AppDatabase[] = [];
afterEach(() => { while (open.length) open.pop()?.close(); });

function setup() {
  const dataDir = mkdtempSync(join(tmpdir(), "qeo-tag-job-"));
  const db = createDatabase(join(dataDir, "test.db"));
  open.push(db);
  migrateDatabase(db);
  const now = Date.now();
  for (const id of ["one", "two"]) {
    db.prepare("INSERT INTO drive_nodes(drive_item_id,name,is_folder,updated_at) VALUES (?, ?, 0, ?)")
      .run(`drive-${id}`, `${id}.jpg`, now);
    db.prepare(`INSERT INTO photos(id,drive_item_id,name,path,size_bytes,etag,created_at,updated_at)
      VALUES (?, ?, ?, ?, 100, ?, ?, ?)`)
      .run(id, `drive-${id}`, `${id}.jpg`, `/Pictures/${id}.jpg`, `etag-${id}`, now, now);
  }
  return { db, dataDir };
}

function imageBytes() {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]).buffer;
}

describe("AI tag worker", () => {
  it("selects at most five known prompts above the versioned threshold", () => {
    const selected = selectAiTagSuggestions([
      { label: "a screenshot", score: 0.30 },
      { label: "a document", score: 0.20 },
      { label: "a receipt", score: 0.10 },
      { label: "a chart", score: 0.08 },
      { label: "a phone", score: 0.06 },
      { label: "a city street", score: 0.05 },
      { label: "a forest", score: 0.03 },
      { label: "unknown label", score: 0.99 },
    ]);

    expect(selected).toHaveLength(5);
    expect(selected.map((item) => item.slug)).toEqual([
      "screenshot", "document", "receipt", "chart", "phone",
    ]);
  });

  it("classifies only photos that need the current model, taxonomy, and ETag", async () => {
    const { db, dataDir } = setup();
    replaceAiTagsForPhoto(db, "one", [], {
      taggedEtag: "etag-one",
      modelId: env.CLIP_MODEL_ID,
      taxonomyVersion: TAG_TAXONOMY_VERSION,
      taggedAt: Date.now(),
    });
    const drive = { getThumbnailContent: vi.fn().mockResolvedValue(imageBytes()) };
    const classifier = {
      initialize: vi.fn().mockResolvedValue(undefined),
      classify: vi.fn().mockResolvedValue([{ label: "a document", score: 0.5 }]),
    };
    const jobId = enqueueJob(db, "tag-photos", {});

    await runTagPhotosJob({ db, dataDir, drive, classifier }, jobId);

    expect(classifier.initialize).toHaveBeenCalledTimes(1);
    expect(drive.getThumbnailContent).toHaveBeenCalledTimes(1);
    expect(classifier.classify).toHaveBeenCalledTimes(1);
    expect(listActiveTagsForPhoto(db, "two").map((tag) => tag.slug)).toEqual(["document"]);
    expect(getJob(db, jobId)?.progressTotal).toBe(1);
  });

  it("initializes once, writes successful tags, and leaves failed images retryable", async () => {
    const { db, dataDir } = setup();
    const initialize = vi.fn().mockResolvedValue(undefined);
    const classify = vi.fn()
      .mockResolvedValueOnce([{ label: "a screenshot", score: 0.5 }])
      .mockRejectedValueOnce(new Error("decode token abc.def.ghi"));
    const warn = vi.fn();
    const jobId = enqueueJob(db, "tag-photos", {});

    await runTagPhotosJob({
      db,
      dataDir,
      drive: { getThumbnailContent: vi.fn().mockResolvedValue(imageBytes()) },
      classifier: { initialize, classify },
      warn,
    }, jobId);

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(classify).toHaveBeenCalledTimes(2);
    expect(listActiveTagsForPhoto(db, "one").map((tag) => tag.slug)).toEqual(["screenshot"]);
    expect(db.prepare("SELECT COUNT(*) AS count FROM photo_tag_state WHERE photo_id = 'one'").get())
      .toEqual({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM photo_tag_state WHERE photo_id = 'two'").get())
      .toEqual({ count: 0 });
    expect(warn).toHaveBeenCalledWith("decode token [REDACTED]");
    expect(getJob(db, jobId)?.progressCurrent).toBe(2);
    expect(getJob(db, jobId)?.progressTotal).toBe(2);
  });

  it("marks a missing OneDrive item deleted and continues", async () => {
    const { db, dataDir } = setup();
    const drive = {
      getThumbnailContent: vi.fn()
        .mockRejectedValueOnce(new GraphRequestError(404, "itemNotFound", "missing"))
        .mockResolvedValueOnce(imageBytes()),
    };
    const classifier = {
      initialize: vi.fn().mockResolvedValue(undefined),
      classify: vi.fn().mockResolvedValue([{ label: "a document", score: 0.5 }]),
    };
    const jobId = enqueueJob(db, "tag-photos", {});

    await runTagPhotosJob({ db, dataDir, drive, classifier }, jobId);

    const deleted = db.prepare("SELECT deleted_remote_at FROM photos WHERE id = 'one'").get() as { deleted_remote_at: number | null };
    expect(deleted.deleted_remote_at).not.toBeNull();
    expect(listActiveTagsForPhoto(db, "two").map((tag) => tag.slug)).toEqual(["document"]);
    expect(getJob(db, jobId)?.progressCurrent).toBe(2);
  });

  it("rethrows non-404 Graph failures instead of treating them as per-image errors", async () => {
    const { db, dataDir } = setup();
    const classifier = {
      initialize: vi.fn().mockResolvedValue(undefined),
      classify: vi.fn(),
    };
    const jobId = enqueueJob(db, "tag-photos", {});

    await expect(runTagPhotosJob({
      db,
      dataDir,
      drive: {
        getThumbnailContent: vi.fn().mockRejectedValue(
          new GraphRequestError(503, "serviceUnavailable", "temporary outage"),
        ),
      },
      classifier,
    }, jobId)).rejects.toThrow("temporary outage");

    expect(classifier.classify).not.toHaveBeenCalled();
    expect(getJob(db, jobId)?.progressCurrent).toBe(0);
  });

  it("fails immediately when classifier initialization fails", async () => {
    const { db, dataDir } = setup();
    const classifier = {
      initialize: vi.fn().mockRejectedValue(new Error("startup failed")),
      classify: vi.fn(),
    };
    const jobId = enqueueJob(db, "tag-photos", {});

    await expect(runTagPhotosJob({
      db,
      dataDir,
      drive: { getThumbnailContent: vi.fn() },
      classifier,
    }, jobId)).rejects.toThrow("startup failed");
    expect(classifier.classify).not.toHaveBeenCalled();
  });
});
