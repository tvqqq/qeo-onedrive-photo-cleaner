"use client";

import { useState } from "react";

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
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium">dHash threshold</span>
          <input
            aria-label="dHash threshold"
            type="number"
            min={0}
            max={64}
            step={1}
            value={dhashThreshold}
            onChange={(event) => setDhashThreshold(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">CLIP threshold</span>
          <input
            aria-label="CLIP threshold"
            type="number"
            min={0.01}
            max={1}
            step={0.01}
            value={clipThreshold}
            onChange={(event) => setClipThreshold(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveThresholds()}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Save thresholds
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void clearThumbnails()}
          className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Clear thumbnail cache
        </button>
      </div>

      {message ? <p className="text-sm text-gray-600">{message}</p> : null}
    </div>
  );
}
