"use client";

import { useState } from "react";

export function ClassifyPhotosButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/categories/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "classify" }),
      });
      const body = await response.json() as { jobId?: string; error?: string };
      if (!response.ok || !body.jobId) throw new Error(body.error ?? "Unable to start classification");
      setMessage(`Classification queued (${body.jobId}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start classification");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Run local classification
      </button>
      {message ? <span className="text-sm text-gray-600">{message}</span> : null}
    </div>
  );
}
