"use client";

import { useState } from "react";

export function SyncAlbumButton({
  categoryId,
  categoryName,
}: {
  categoryId: string;
  categoryName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/categories/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync-album", categoryId }),
      });
      const body = await response.json() as { albumId?: string; added?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to sync album");
      const added = body.added ?? 0;
      setMessage(`${added} photo${added === 1 ? "" : "s"} added.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sync album");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => void sync()}
        className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Syncing…" : `Sync ${categoryName} album`}
      </button>
      {message ? <span className="text-sm text-gray-600">{message}</span> : null}
    </div>
  );
}
