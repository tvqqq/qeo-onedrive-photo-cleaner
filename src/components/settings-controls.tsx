"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

async function postSettings(body: unknown) {
  const response = await fetch("/api/settings/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { error?: string; removedFiles?: number };
  if (!response.ok) throw new Error(payload.error ?? "Settings action failed");
  return payload;
}

export function SettingsControls({
  dhashThreshold: initialDhashThreshold,
  clipThreshold: initialClipThreshold,
}: {
  dhashThreshold: number;
  clipThreshold: number;
}) {
  const [dhashThreshold, setDhashThreshold] = useState(String(initialDhashThreshold));
  const [clipThreshold, setClipThreshold] = useState(String(initialClipThreshold));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveThresholds() {
    setBusy(true);
    setMessage(null);
    try {
      await postSettings({
        action: "update-thresholds",
        dhashThreshold: Number(dhashThreshold),
        clipThreshold: Number(clipThreshold),
      });
      setMessage("Thresholds saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save thresholds");
    } finally {
      setBusy(false);
    }
  }

  async function clearThumbnails() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await postSettings({ action: "clear-thumbnails" });
      const removed = result.removedFiles ?? 0;
      setMessage(`${removed} thumbnail${removed === 1 ? "" : "s"} removed. Models and indexed photos were kept.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to clear thumbnail cache");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h2 className="font-medium text-zinc-100">Duplicate detection thresholds</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            Defaults remain conservative. Similar matches are review-only regardless of these values.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-zinc-300">
            <span className="font-medium">dHash threshold</span>
            <input
              aria-label="dHash threshold"
              type="number"
              min={0}
              max={64}
              step={1}
              value={dhashThreshold}
              onChange={(event) => setDhashThreshold(event.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500"
            />
          </label>
          <label className="space-y-2 text-sm text-zinc-300">
            <span className="font-medium">CLIP threshold</span>
            <input
              aria-label="CLIP threshold"
              type="number"
              min={0.01}
              max={1}
              step={0.01}
              value={clipThreshold}
              onChange={(event) => setClipThreshold(event.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500"
            />
          </label>
        </div>
        <Button type="button" variant="primary" disabled={busy} onClick={() => void saveThresholds()}>
          Save thresholds
        </Button>
      </div>

      <div className="border-t border-zinc-800 pt-6">
        <h2 className="font-medium text-zinc-100">Thumbnail cache</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-400">
          Clears locally cached thumbnails only. Models, the SQLite index, review state, and OneDrive originals are kept.
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void clearThumbnails()}
          className="mt-4"
        >
          Clear thumbnail cache
        </Button>
      </div>

      {message ? <p className="text-sm text-zinc-300" role="status">{message}</p> : null}
    </div>
  );
}
