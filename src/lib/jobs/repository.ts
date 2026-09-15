import { randomUUID } from "node:crypto";
import type { AppDatabase } from "@/lib/db/client";
import type { JobRecord, JobType, WorkerLane } from "@/lib/jobs/types";

const JOB_TYPES_BY_LANE = {
  core: ["scan", "verify-exact"],
  ml: ["classify", "find-similar"],
} as const satisfies Record<WorkerLane, readonly JobType[]>;

type JobRow = {
  id: string;
  type: JobType;
  status: JobRecord["status"];
  payload_json: string;
  progress_current: number;
  progress_total: number | null;
  error: string | null;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  updated_at: number;
};

function mapRow(row: JobRow): JobRecord {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    payload: JSON.parse(row.payload_json) as unknown,
    progressCurrent: row.progress_current,
    progressTotal: row.progress_total,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    updatedAt: row.updated_at,
  };
}

export function jobTypesForLane(lane: WorkerLane): readonly JobType[] {
  return JOB_TYPES_BY_LANE[lane];
}

export function enqueueJob(db: AppDatabase, type: JobType, payload: unknown): string {
  const id = randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO jobs(id, type, status, payload_json, created_at, updated_at)
    VALUES (?, ?, 'queued', ?, ?, ?)
  `).run(id, type, JSON.stringify(payload), now, now);
  return id;
}

export function getJob(db: AppDatabase, id: string): JobRecord | null {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
  return row ? mapRow(row) : null;
}

export function claimNextJob(db: AppDatabase, lane: WorkerLane = "core"): JobRecord | null {
  const types = jobTypesForLane(lane);
  const placeholders = types.map(() => "?").join(", ");

  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare(`
      SELECT * FROM jobs
      WHERE status = 'queued' AND type IN (${placeholders})
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `).get(...types) as JobRow | undefined;

    if (!row) {
      db.exec("COMMIT");
      return null;
    }

    const now = Date.now();
    db.prepare(`
      UPDATE jobs
      SET status = 'running', started_at = ?, updated_at = ?, error = NULL
      WHERE id = ? AND status = 'queued'
    `).run(now, now, row.id);
    db.exec("COMMIT");
    return getJob(db, row.id);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function requeueInterruptedJobs(db: AppDatabase, lane: WorkerLane = "core"): number {
  const types = jobTypesForLane(lane);
  const placeholders = types.map(() => "?").join(", ");
  const now = Date.now();
  const result = db.prepare(`
    UPDATE jobs
    SET status = 'queued', started_at = NULL, updated_at = ?
    WHERE status = 'running' AND type IN (${placeholders})
  `).run(now, ...types);
  return Number(result.changes);
}

export function updateJobPayload(db: AppDatabase, id: string, payload: unknown): void {
  db.prepare(`UPDATE jobs SET payload_json = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(payload), Date.now(), id);
}

export function updateJobProgress(
  db: AppDatabase,
  id: string,
  current: number,
  total: number | null = null,
): void {
  db.prepare(`
    UPDATE jobs SET progress_current = ?, progress_total = ?, updated_at = ? WHERE id = ?
  `).run(current, total, Date.now(), id);
}

export function finishJob(db: AppDatabase, id: string): void {
  const now = Date.now();
  db.prepare(`
    UPDATE jobs SET status = 'completed', finished_at = ?, updated_at = ? WHERE id = ?
  `).run(now, now, id);
}

export function failJob(db: AppDatabase, id: string, error: string): void {
  const now = Date.now();
  db.prepare(`
    UPDATE jobs SET status = 'failed', error = ?, finished_at = ?, updated_at = ? WHERE id = ?
  `).run(error, now, now, id);
}
