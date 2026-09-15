"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ScanMode = "full" | "incremental";

type Job = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progressCurrent: number;
  progressTotal: number | null;
  error: string | null;
};

const STATUS_LABEL: Record<Job["status"], string> = {
  queued: "Waiting for worker",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

function statusTone(status: Job["status"]): "neutral" | "info" | "success" | "danger" {
  if (status === "running") return "info";
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  return "neutral";
}

export function JobProgress() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [mode, setMode] = useState<ScanMode | null>(null);
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

  async function start(nextMode: ScanMode) {
    setStarting(true);
    setMode(nextMode);
    setJobId(null);
    setJob(null);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
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
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          disabled={starting}
          onClick={() => void start("incremental")}
        >
          Incremental scan
        </Button>
        <Button
          variant="secondary"
          disabled={starting}
          onClick={() => void start("full")}
        >
          Full scan
        </Button>
      </div>

      {job ? (
        <div className="grid gap-4 border-t border-zinc-800 pt-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Mode</p>
            <p className="mt-2 font-medium text-zinc-100">
              {mode === "full" ? "Full scan" : "Incremental scan"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</p>
            <div className="mt-2">
              <Badge tone={statusTone(job.status)}>{STATUS_LABEL[job.status]}</Badge>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Progress</p>
            <p className="mt-2 font-medium text-zinc-100">
              {job.progressTotal === null
                ? `Processed ${job.progressCurrent.toLocaleString()}`
                : `Processed ${job.progressCurrent.toLocaleString()} / ${job.progressTotal.toLocaleString()}`}
            </p>
          </div>
          {job.error ? (
            <p className="sm:col-span-3 rounded-lg border border-red-900/80 bg-red-950/40 px-3 py-2 text-red-200">
              {job.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
