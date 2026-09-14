import { createHash } from "node:crypto";
import type { AppDatabase } from "@/lib/db/client";
import { updateJobProgress } from "@/lib/jobs/repository";
import { recommendKeep } from "./recommend";

export interface ExactCandidateItem {
  id: string;
  driveItemId: string;
  name: string;
  path: string;
  sizeBytes: number;
  quickxorHash: string;
  etag: string | null;
  remoteCreatedAt?: number | null;
  sha256?: string | null;
  sha256Etag?: string | null;
}

export interface CandidateGroup {
  sizeBytes: number;
  quickxorHash: string;
  items: ExactCandidateItem[];
}

export interface VerifiedExactGroup {
  sha256: string;
  items: Array<ExactCandidateItem & { sha256: string }>;
}

export async function computeSha256(stream: ReadableStream<Uint8Array>): Promise<string> {
  const hash = createHash("sha256");
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) hash.update(value);
    }
  } finally {
    reader.releaseLock();
  }
  return hash.digest("hex");
}

export async function verifyExactCandidateGroup(
  items: ExactCandidateItem[],
  openContent: (driveItemId: string) => Promise<ReadableStream<Uint8Array>>,
): Promise<VerifiedExactGroup | null> {
  if (items.length < 2) return null;
  const expectedSize = items[0]?.sizeBytes;
  const expectedQuickxor = items[0]?.quickxorHash;
  if (items.some((item) => item.sizeBytes !== expectedSize || item.quickxorHash !== expectedQuickxor)) {
    return null;
  }

  const verified: Array<ExactCandidateItem & { sha256: string }> = [];
  let expectedSha: string | null = null;
  for (const item of items) {
    const sha256 = await computeSha256(await openContent(item.driveItemId));
    if (expectedSha === null) expectedSha = sha256;
    if (sha256 !== expectedSha) return null;
    verified.push({ ...item, sha256 });
  }
  return expectedSha ? { sha256: expectedSha, items: verified } : null;
}

export function findExactCandidates(db: AppDatabase): CandidateGroup[] {
  const rows = db.prepare(`
    SELECT id, drive_item_id, name, path, size_bytes, quickxor_hash, etag,
           remote_created_at, sha256, sha256_etag
    FROM photos
    WHERE deleted_remote_at IS NULL AND quickxor_hash IS NOT NULL AND quickxor_hash <> ''
    ORDER BY size_bytes, quickxor_hash, drive_item_id
  `).all() as Array<{
    id: string;
    drive_item_id: string;
    name: string;
    path: string;
    size_bytes: number;
    quickxor_hash: string;
    etag: string | null;
    remote_created_at: number | null;
    sha256: string | null;
    sha256_etag: string | null;
  }>;

  const groups = new Map<string, ExactCandidateItem[]>();
  for (const row of rows) {
    const key = `${row.size_bytes}\0${row.quickxor_hash}`;
    const items = groups.get(key) ?? [];
    items.push({
      id: row.id,
      driveItemId: row.drive_item_id,
      name: row.name,
      path: row.path,
      sizeBytes: row.size_bytes,
      quickxorHash: row.quickxor_hash,
      etag: row.etag,
      remoteCreatedAt: row.remote_created_at,
      sha256: row.sha256,
      sha256Etag: row.sha256_etag,
    });
    groups.set(key, items);
  }

  return [...groups.values()]
    .filter((items) => items.length > 1)
    .map((items) => ({
      sizeBytes: items[0]!.sizeBytes,
      quickxorHash: items[0]!.quickxorHash,
      items,
    }));
}

async function verifyWithCache(
  db: AppDatabase,
  group: CandidateGroup,
  openContent: (driveItemId: string) => Promise<ReadableStream<Uint8Array>>,
): Promise<VerifiedExactGroup | null> {
  const verified: Array<ExactCandidateItem & { sha256: string }> = [];
  let expectedSha: string | null = null;

  for (const item of group.items) {
    const sha256 = item.sha256 && item.sha256Etag === item.etag
      ? item.sha256
      : await computeSha256(await openContent(item.driveItemId));
    db.prepare(`UPDATE photos SET sha256 = ?, sha256_etag = ?, updated_at = ? WHERE id = ?`)
      .run(sha256, item.etag, Date.now(), item.id);
    if (expectedSha === null) expectedSha = sha256;
    if (sha256 !== expectedSha) return null;
    verified.push({ ...item, sha256 });
  }

  return expectedSha ? { sha256: expectedSha, items: verified } : null;
}

function persistVerifiedGroup(db: AppDatabase, group: VerifiedExactGroup): void {
  const id = `exact:${group.sha256}`;
  const now = Date.now();
  const keeperId = recommendKeep(group.items);

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      INSERT INTO duplicate_groups(id,type,confidence,status,verified_sha256,created_at)
      VALUES (?, 'exact', 1, 'pending', ?, ?)
      ON CONFLICT(id) DO UPDATE SET confidence = 1, verified_sha256 = excluded.verified_sha256
    `).run(id, group.sha256, now);
    const status = db.prepare("SELECT status FROM duplicate_groups WHERE id = ?").get(id) as { status: string };
    if (status.status === "pending") {
      db.prepare("DELETE FROM duplicate_group_items WHERE group_id = ?").run(id);
      const insert = db.prepare(`
        INSERT INTO duplicate_group_items(
          group_id, photo_id, recommended_keep, selected_for_delete, reviewed_etag
        ) VALUES (?, ?, ?, ?, ?)
      `);
      for (const item of group.items) {
        const keep = item.id === keeperId;
        insert.run(id, item.id, keep ? 1 : 0, keep ? 0 : 1, item.etag);
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export interface ExactJobContext {
  db: AppDatabase;
  drive: { openContent(itemId: string): Promise<ReadableStream<Uint8Array>> };
}

export async function runExactDuplicateJob(context: ExactJobContext, jobId: string): Promise<void> {
  const groups = findExactCandidates(context.db);
  let processed = 0;
  for (const group of groups) {
    const verified = await verifyWithCache(context.db, group, (id) => context.drive.openContent(id));
    if (verified) persistVerifiedGroup(context.db, verified);
    processed += 1;
    updateJobProgress(context.db, jobId, processed, groups.length);
  }
}
