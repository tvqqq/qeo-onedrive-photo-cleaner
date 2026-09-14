export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobType = "scan" | "verify-exact" | "find-similar" | "classify" | "sync-album";

export interface JobRecord<T = unknown> {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: T;
  progressCurrent: number;
  progressTotal: number | null;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  updatedAt: number;
}
