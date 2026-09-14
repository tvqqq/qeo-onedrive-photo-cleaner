import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { enqueueJob, getJob } from "@/lib/jobs/repository";
import { runClassificationJob } from "@/lib/classification/service";

const open: AppDatabase[] = [];
afterEach(() => { while (open.length) open.pop()?.close(); });

function setup() {
  const dataDir = mkdtempSync(join(tmpdir(), "qeo-classify-job-"));
  const db = createDatabase(join(dataDir, "test.db"));
  open.push(db);
  migrateDatabase(db);
  const now = Date.now();
  const photos = [
    { id: "screen", driveId: "drive-screen", name: "Screenshot 2026-09-14.png", path: "/Pictures/Screenshots/Screenshot 2026-09-14.png" },
    { id: "photo", driveId: "drive-photo", name: "IMG_1234.jpg", path: "/Pictures/Camera Roll/IMG_1234.jpg" },
  ];
  for (const photo of photos) {
    db.prepare("INSERT INTO drive_nodes(drive_item_id,name,is_folder,updated_at) VALUES (?, ?, 0, ?)")
      .run(photo.driveId, photo.name, now);
    db.prepare(`INSERT INTO photos(id,drive_item_id,name,path,size_bytes,etag,created_at,updated_at)
      VALUES (?, ?, ?, ?, 100, ?, ?, ?)`)
      .run(photo.id, photo.driveId, photo.name, photo.path, `etag-${photo.id}`, now, now);
  }
  return { db, dataDir };
}

async function jpegBytes() {
  const buffer = await sharp({
    create: { width: 24, height: 24, channels: 3, background: { r: 30, g: 140, b: 220 } },
  }).jpeg().toBuffer();
  return Uint8Array.from(buffer).buffer;
}

describe("classification job", () => {
  it("runs deterministic rules before local model inference", async () => {
    const { db, dataDir } = setup();
    const drive = { getThumbnailContent: vi.fn().mockResolvedValue(await jpegBytes()) };
    const classifier = { classify: vi.fn().mockResolvedValue([
      { label: "travel", score: 0.88 },
      { label: "nature", score: 0.45 },
    ]) };
    const jobId = enqueueJob(db, "classify", {});

    await runClassificationJob({ db, drive, classifier, dataDir }, jobId);

    expect(drive.getThumbnailContent).toHaveBeenCalledTimes(1);
    expect(classifier.classify).toHaveBeenCalledTimes(1);
    expect(classifier.classify.mock.calls[0]?.[1]).toContain("travel");
    expect(classifier.classify.mock.calls[0]?.[1]).not.toContain("other");

    const rows = db.prepare(`SELECT pc.photo_id, c.slug, pc.source
      FROM photo_categories pc JOIN categories c ON c.id = pc.category_id
      ORDER BY pc.photo_id, pc.confidence DESC`).all() as Array<{ photo_id: string; slug: string; source: string }>;
    expect(rows).toEqual([
      { photo_id: "photo", slug: "travel", source: "local-ai" },
      { photo_id: "photo", slug: "nature", source: "local-ai" },
      { photo_id: "screen", slug: "screenshots", source: "rule" },
    ]);
    expect(getJob(db, jobId)?.progressCurrent).toBe(2);
    expect(getJob(db, jobId)?.progressTotal).toBe(2);
  });
});
