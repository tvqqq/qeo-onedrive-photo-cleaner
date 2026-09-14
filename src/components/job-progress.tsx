"use client";

import { useEffect, useState } from "react";

type Job = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progressCurrent: number;
  progressTotal: number | null;
  error: string | null;
};

export function JobProgress() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const next = await response.json() as Job;
      setJob(next);
      if (!cancelled && (next.status === "queued" || next.status === "running")) {
        timer = setTimeout(() => { void poll(); }, 1000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  async function start(mode: "full" | "incremental") {
    setStarting(true);
    setJob(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const body = await response.json() as { jobId?: string; error?: string };
      if (!response.ok || !body.jobId) throw new Error(body.error ?? "Unable to start scan");
      setJobId(body.jobId);
    } catch (error) {
      setJob({
        id: "error",
        status: "failed",
        progressCurrent: 0,
        progressTotal: null,
        error: error instanceof Error ? error.message : "Unable to start scan",
      });
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border p-5">
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={starting}
          onClick={() => void start("incremental")}
        >
          Incremental scan
        </button>
        <button
          className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={starting}
          onClick={() => void start("full")}
        >
          Full scan
        </button>
      </div>
      {job && (
        <div className="text-sm">
          <p>Status: <strong>{job.status}</strong></p>
          <p>Processed: {job.progressCurrent}</p>
          {job.error && <p className="text-red-600">{job.error}</p>}
        </div>
      )}
    </section>
  );
}
