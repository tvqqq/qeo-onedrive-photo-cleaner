"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeletePhotoControl({
  photoId,
  filename,
  onDeleted,
}: {
  photoId: string;
  filename: string;
  onDeleted(photoId: string): void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/photos/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", photoId }),
      });
      const body = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok || body.deleted !== true) throw new Error(body.error ?? "Unable to delete photo");
      onDeleted(photoId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete photo");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-400">Move this photo to the OneDrive Recycle Bin. This app never permanently deletes it.</p>
        <Button type="button" variant="danger" onClick={() => setConfirming(true)}>Delete photo…</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-red-950 bg-red-950/20 p-4">
      <p className="text-sm text-red-100">
        Move <strong>{filename}</strong> to the <strong>OneDrive Recycle Bin</strong>?
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}>
          {busy ? "Deleting…" : "Confirm delete"}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => { setConfirming(false); setError(null); }}>
          Cancel
        </Button>
      </div>
      {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
