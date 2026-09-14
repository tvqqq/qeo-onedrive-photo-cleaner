import { createHash } from "node:crypto";
import sharp from "sharp";
import type { AppDatabase } from "@/lib/db/client";

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
const HASH_MASK = (1n << 64n) - 1n;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SimilarCandidatePair {
  leftPhotoId: string;
  rightPhotoId: string;
  hammingDistance: number;
  sharedBands: number;
  clipSimilarity?: number;
}

export async function computeDHash(path: string): Promise<bigint> {
  const { data } = await sharp(path)
    .greyscale()
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = 0n;
  for (let y = 0; y < HASH_HEIGHT; y += 1) {
    for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
      hash <<= 1n;
      const offset = y * HASH_WIDTH + x;
      if (data[offset] > data[offset + 1]) hash |= 1n;
    }
  }
  return hash & HASH_MASK;
}

export function hammingDistance64(a: bigint, b: bigint): number {
  let value = (a ^ b) & HASH_MASK;
  let distance = 0;
  while (value !== 0n) {
    value &= value - 1n;
    distance += 1;
  }
  return distance;
}

export function splitDHashBands(hash: bigint): [number, number, number, number] {
  const value = hash & HASH_MASK;
  return [
    Number((value >> 48n) & 0xffffn),
    Number((value >> 32n) & 0xffffn),
    Number((value >> 16n) & 0xffffn),
    Number(value & 0xffffn),
  ];
}

function parseHash(value: string): bigint {
  return BigInt(`0x${value.padStart(16, "0")}`);
}

export function findSimilarCandidates(db: AppDatabase, maxHammingDistance = 8): SimilarCandidatePair[] {
  const rows = db.prepare(`
    SELECT
      a.photo_id AS left_photo_id,
      b.photo_id AS right_photo_id,
      a.dhash AS left_dhash,
      b.dhash AS right_dhash,
      p1.taken_at AS left_taken_at,
      p2.taken_at AS right_taken_at,
      (CASE WHEN a.lsh_band_0 = b.lsh_band_0 THEN 1 ELSE 0 END +
       CASE WHEN a.lsh_band_1 = b.lsh_band_1 THEN 1 ELSE 0 END +
       CASE WHEN a.lsh_band_2 = b.lsh_band_2 THEN 1 ELSE 0 END +
       CASE WHEN a.lsh_band_3 = b.lsh_band_3 THEN 1 ELSE 0 END) AS shared_bands
    FROM photo_features a
    JOIN photo_features b ON a.photo_id < b.photo_id AND (
      a.lsh_band_0 = b.lsh_band_0 OR
      a.lsh_band_1 = b.lsh_band_1 OR
      a.lsh_band_2 = b.lsh_band_2 OR
      a.lsh_band_3 = b.lsh_band_3
    )
    JOIN photos p1 ON p1.id = a.photo_id
    JOIN photos p2 ON p2.id = b.photo_id
    WHERE a.dhash IS NOT NULL AND b.dhash IS NOT NULL
      AND p1.deleted_remote_at IS NULL AND p2.deleted_remote_at IS NULL
      AND (a.feature_etag IS NULL OR a.feature_etag = p1.etag)
      AND (b.feature_etag IS NULL OR b.feature_etag = p2.etag)
    ORDER BY a.photo_id, b.photo_id
  `).all() as Array<{
    left_photo_id: string;
    right_photo_id: string;
    left_dhash: string;
    right_dhash: string;
    left_taken_at: number | null;
    right_taken_at: number | null;
    shared_bands: number;
  }>;

  const pairs: SimilarCandidatePair[] = [];
  for (const row of rows) {
    const distance = hammingDistance64(parseHash(row.left_dhash), parseHash(row.right_dhash));
    if (distance > maxHammingDistance) continue;

    const bothTimestamped = row.left_taken_at !== null && row.right_taken_at !== null;
    if (bothTimestamped) {
      if (Math.abs(row.left_taken_at! - row.right_taken_at!) > DAY_MS) continue;
    } else if (row.shared_bands < 2) {
      continue;
    }

    pairs.push({
      leftPhotoId: row.left_photo_id,
      rightPhotoId: row.right_photo_id,
      hammingDistance: distance,
      sharedBands: row.shared_bands,
    });
  }
  return pairs;
}

function connectedComponents(pairs: SimilarCandidatePair[]): string[][] {
  const graph = new Map<string, Set<string>>();
  for (const pair of pairs) {
    if (!graph.has(pair.leftPhotoId)) graph.set(pair.leftPhotoId, new Set());
    if (!graph.has(pair.rightPhotoId)) graph.set(pair.rightPhotoId, new Set());
    graph.get(pair.leftPhotoId)!.add(pair.rightPhotoId);
    graph.get(pair.rightPhotoId)!.add(pair.leftPhotoId);
  }

  const seen = new Set<string>();
  const result: string[][] = [];
  for (const start of [...graph.keys()].sort()) {
    if (seen.has(start)) continue;
    const stack = [start];
    const component: string[] = [];
    seen.add(start);
    while (stack.length) {
      const current = stack.pop()!;
      component.push(current);
      for (const next of graph.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    if (component.length > 1) result.push(component.sort());
  }
  return result;
}

export function persistSimilarGroups(db: AppDatabase, pairs: SimilarCandidatePair[]): void {
  if (pairs.length === 0) return;
  const components = connectedComponents(pairs);
  const now = Date.now();

  db.exec("BEGIN IMMEDIATE");
  try {
    const insertGroup = db.prepare(`
      INSERT INTO duplicate_groups(id,type,confidence,status,created_at)
      VALUES (?, 'similar', ?, 'pending', ?)
      ON CONFLICT(id) DO UPDATE SET confidence = excluded.confidence
    `);
    const insertItem = db.prepare(`
      INSERT INTO duplicate_group_items(
        group_id, photo_id, recommended_keep, selected_for_delete, reviewed_etag
      )
      SELECT ?, p.id, 0, 0, p.etag FROM photos p WHERE p.id = ?
      ON CONFLICT(group_id, photo_id) DO NOTHING
    `);

    for (const photoIds of components) {
      const pairScores = pairs
        .filter((pair) => photoIds.includes(pair.leftPhotoId) && photoIds.includes(pair.rightPhotoId))
        .map((pair) => pair.clipSimilarity ?? Math.max(0, 1 - pair.hammingDistance / 64));
      const confidence = pairScores.length ? Math.min(...pairScores) : null;
      const digest = createHash("sha256").update(photoIds.join("\0")).digest("hex");
      const groupId = `similar:${digest}`;
      insertGroup.run(groupId, confidence, now);
      for (const photoId of photoIds) insertItem.run(groupId, photoId);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
