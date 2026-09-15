"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";

export function GenerateAiTagsButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/photos/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate-tags" }),
      });
      const body = await response.json() as { jobId?: string; error?: string };
      if (!response.ok || !body.jobId) throw new Error(body.error ?? "Unable to queue AI tags");
      setMessage("AI tagging queued.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to queue AI tags");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={() => void generate()} className={buttonClass("secondary")}>
        {busy ? "Queuing…" : "Generate AI Tags"}
      </button>
      {message ? <span className="text-xs text-zinc-400">{message}</span> : null}
    </div>
  );
}
