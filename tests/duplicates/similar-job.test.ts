import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { enqueueJob, getJob } from "@/lib/jobs/repository";
import { runSimilarPhotoJob } from "@/lib/duplicates/similar";

const open: AppDatabase[] = [];

afterEach(() => {
  while (open.length) open.pop()?.close();
});

function setup() {
  const dataDir = mkdtempSync(join(tmpdir(), "qeo-similar-job-"));
  const db = createDatabase(join(dataDir, "test.db"));
  open.push(db);
  migrateDatabase(db);
  const now = Date.now();
  for (const id of ["a", "b"]) {
    db.prepare("INSERT INTO drive_nodes(drive_item_id,name,is_folder,updated_at) VALUES (?, ?, 0, ?)")
      .run(`drive-${id}`, `${id}.jpg`, now);
    db.prepare(`
      INSERT INTO photos(id,drive_item_id,name,path,size_bytes,taken_at,etag,created_at,updated_at)
      VALUES (?, ?, ?, ?, 100, ?, ?, ?, ?)
    `).run(id, `drive-${id}`, `${id}.jpg`, `/Pictures/${id}.jpg`, now, `etag-${id}`, now, now);
  }
  return { db, dataDir };
}

async function jpegBytes() {
  const buffer = await sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 120, g: 80, b: 40 } },
  }).jpeg().toBuffer();
  return Uint8Array.from(buffer).buffer;
}

describe("similar photo job", () => {
  it("persists only CLIP-confirmed pairs and leaves them unchecked", async () => {
    const { db, dataDir } = setup();
    const bytes = await jpegBytes();
    const drive = { getThumbnailContent: vi.fn().mockResolvedValue(bytes) };
    const clip = { embedImage: vi.fn()
      .mockResolvedValueOnce(new Float32Array([1, 0]))
      .mockResolvedValueOnce(new Float32Array([1, 0])) };
    const jobId = enqueueJob(db, "find-similar", {});

    await runSimilarPhotoJob({ db, drive, clip, dataDir }, jobId);

    const group = db.prepare("SELECT type, confidence FROM duplicate_groups WHERE type = 'similar'").get() as { type: string; confidence: number };
    const selected = db.prepare("SELECT selected_for_delete FROM duplicate_group_items ORDER BY photo_id").all() as Array<{ selected_for_delete: number }>;
    expect(group.type).toBe("similar");
    expect(group.confidence).toBeGreaterThanOrEqual(0.94);
    expect(selected.map((row) => row.selected_for_delete)).toEqual([0, 0]);
    expect(getJob(db, jobId)?.progressCurrent).toBe(2);
  });

  it("rejects visually close dHash candidates when CLIP similarity is below threshold", async () => {
    const { db, dataDir } = setup();
    const bytes = await jpegBytes();
    const drive = { getThumbnailContent: vi.fn().mockResolvedValue(bytes) };
    const clip = { embedImage: vi.fn()
      .mockResolvedValueOnce(new Float32Array([1, 0]))
      .mockResolvedValueOnce(new Float32Array([0, 1])) };
    const jobId = enqueueJob(db, "find-similar", {});

    await runSimilarPhotoJob({ db, drive, clip, dataDir }, jobId);

    const count = db.prepare("SELECT COUNT(*) AS count FROM duplicate_groups WHERE type = 'similar'").get() as { count: number };
    expect(count.count).toBe(0);
  });

  it("reuses cached features while ETags stay unchanged", async () => {
    const { db, dataDir } = setup();
    const bytes = await jpegBytes();
    const drive = { getThumbnailContent: vi.fn().mockResolvedValue(bytes) };
    const clip = { embedImage: vi.fn().mockResolvedValue(new Float32Array([1, 0])) };

    await runSimilarPhotoJob({ db, drive, clip, dataDir }, enqueueJob(db, "find-similar", {}));
    await runSimilarPhotoJob({ db, drive, clip, dataDir }, enqueueJob(db, "find-similar", {}));

    expect(drive.getThumbnailContent).toHaveBeenCalledTimes(2);
    expect(clip.embedImage).toHaveBeenCalledTimes(2);
  });
});
