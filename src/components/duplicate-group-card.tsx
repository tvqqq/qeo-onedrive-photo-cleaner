"use client";

import { useState } from "react";
import { PhotoCard } from "@/components/photo-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PhotoMetadata } from "@/lib/photos/types";

export interface DuplicateCardItem {
  photo: PhotoMetadata;
  recommendedKeep: boolean;
  selectedForDelete: boolean;
}

export function DuplicateGroupCard({
  groupId,
  verifiedSha256,
  items,
}: {
  groupId: string;
  verifiedSha256: string;
  items: DuplicateCardItem[];
}) {
  const [selected, setSelected] = useState(() => new Set(
    items
      .filter((item) => !item.recommendedKeep && item.selectedForDelete)
      .map((item) => item.photo.photoId),
  ));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function approve() {
    if (selected.size === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/duplicates/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", groupId, selectedPhotoIds: [...selected] }),
      });
      const body = await response.json() as { error?: string; deleted?: number };
      if (!response.ok) throw new Error(body.error ?? "Delete failed");
      setMessage(`Moved ${body.deleted ?? 0} duplicate(s) to OneDrive Recycle Bin.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">Verified exact</Badge>
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{items.length} files</span>
          </div>
          <p className="mt-3 break-all text-xs text-zinc-500">
            Verified SHA-256: <span className="font-mono text-zinc-300">{verifiedSha256}</span>
          </p>
        </div>
        <p className="max-w-md text-sm leading-6 text-zinc-400">
          Only non-keeper files can be selected. Approval moves reviewed copies to the OneDrive Recycle Bin.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <PhotoCard key={item.photo.photoId} photo={item.photo}>
            {item.recommendedKeep ? (
              <Badge tone="success">Recommended keep</Badge>
            ) : (
              <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  aria-label={`Move ${item.photo.name} to Recycle Bin`}
                  checked={selected.has(item.photo.photoId)}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) next.add(item.photo.photoId);
                    else next.delete(item.photo.photoId);
                    setSelected(next);
                  }}
                  className="mt-0.5 h-4 w-4 accent-red-500"
                />
                <span>
                  Move <strong>{item.photo.name}</strong> to Recycle Bin
                </span>
              </label>
            )}
          </PhotoCard>
        ))}
      </div>

      <div className="rounded-xl border border-red-950/80 bg-red-950/30 p-4">
        <p className="text-sm font-medium text-red-200">Review destructive action</p>
        <p className="mt-1 text-xs leading-5 text-red-300/80">
          This never permanently deletes files. Selected verified copies are moved to the OneDrive Recycle Bin and can be restored there.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="danger"
            disabled={busy || selected.size === 0}
            onClick={() => void approve()}
          >
            {busy ? "Moving…" : `Approve ${selected.size} deletion${selected.size === 1 ? "" : "s"}`}
          </Button>
          <span className="text-xs text-zinc-500">
            {selected.size} reviewed {selected.size === 1 ? "copy" : "copies"} selected
          </span>
        </div>
      </div>

      {message ? <p role="status" className="text-sm text-zinc-200">{message}</p> : null}
    </article>
  );
}
