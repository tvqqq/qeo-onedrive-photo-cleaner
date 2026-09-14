import type { AppDatabase } from "@/lib/db/client";
import {
  getScanState,
  markDriveItemDeleted,
  setScanState,
  upsertDriveNode,
  upsertPhoto,
} from "@/lib/db/repositories";
import type { DeltaPage, GraphDriveItem } from "@/lib/graph/types";
import { getJob, updateJobPayload, updateJobProgress } from "@/lib/jobs/repository";

export type ScanMode = "full" | "incremental";

export interface ScanDriveApi {
  getDeltaPage(url?: string): Promise<DeltaPage>;
}

export interface ScanContext {
  db: AppDatabase;
  drive: ScanDriveApi;
}

export function isPhotoCandidate(item: GraphDriveItem): boolean {
  return !item.deleted && Boolean(item.file?.mimeType?.startsWith("image/"));
}

function processItem(db: AppDatabase, item: GraphDriveItem, now: number) {
  upsertDriveNode(db, item, now);
  if (item.deleted) {
    markDriveItemDeleted(db, item.id, now);
    return;
  }
  if (isPhotoCandidate(item)) upsertPhoto(db, item, now);
}

export async function runScanJob(
  context: ScanContext,
  jobId: string,
  mode: ScanMode,
): Promise<void> {
  const initialJob = getJob(context.db, jobId);
  if (!initialJob) throw new Error(`Scan job ${jobId} not found`);
  const payload = (initialJob.payload ?? {}) as { mode?: ScanMode; nextLink?: string };
  let nextLink = payload.nextLink;
  if (!nextLink && mode === "incremental") {
    nextLink = getScanState(context.db, "deltaLink") ?? undefined;
  }
  let processed = initialJob.progressCurrent;

  while (true) {
    const page = await context.drive.getDeltaPage(nextLink);
    const now = Date.now();

    context.db.exec("BEGIN IMMEDIATE");
    try {
      for (const item of page.items) {
        processItem(context.db, item, now);
        processed += 1;
      }

      const nextPayload = page.nextLink
        ? { mode, nextLink: page.nextLink }
        : { mode };
      updateJobProgress(context.db, jobId, processed, null);
      updateJobPayload(context.db, jobId, nextPayload);
      if (!page.nextLink && page.deltaLink) {
        setScanState(context.db, "deltaLink", page.deltaLink);
      }
      context.db.exec("COMMIT");
    } catch (error) {
      context.db.exec("ROLLBACK");
      throw error;
    }

    if (!page.nextLink) return;
    nextLink = page.nextLink;
  }
}
