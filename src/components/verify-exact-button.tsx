"use client";

import { useState } from "react";

export function VerifyExactButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/duplicates/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "verify-exact" }),
      });
      const body = await response.json() as { jobId?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to start verification");
      setMessage(`Verification queued${body.jobId ? ` (${body.jobId})` : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start verification");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={() => void run()}>
        Verify exact duplicates
      </button>
      {message && <span className="text-sm text-gray-600">{message}</span>}
    </div>
  );
}
