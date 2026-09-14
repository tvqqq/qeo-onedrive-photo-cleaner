"use client";

import { useState } from "react";
import { PhotoThumb } from "./photo-thumb";

export interface DuplicateCardItem {
  photoId: string;
  name: string;
  path: string;
  sizeBytes: number;
  recommendedKeep: boolean;
  selectedForDelete: boolean;
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function DuplicateGroupCard({ groupId, items }: { groupId: string; items: DuplicateCardItem[] }) {
  const [selected, setSelected] = useState(() => new Set(items.filter((item) => item.selectedForDelete).map((item) => item.photoId)));
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
    <article className="space-y-4 rounded-xl border p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <label key={item.photoId} className="space-y-2 rounded-lg border p-3">
            <PhotoThumb photoId={item.photoId} alt={item.name} className="w-full" />
            <div className="text-sm">
              <p className="font-medium">{item.name}</p>
              <p className="truncate text-gray-500">{item.path}</p>
              <p className="text-gray-500">{formatBytes(item.sizeBytes)}</p>
            </div>
            {item.recommendedKeep ? (
              <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">Recommended keep</span>
            ) : (
              <span className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(item.photoId)}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) next.add(item.photoId); else next.delete(item.photoId);
                    setSelected(next);
                  }}
                />
                Move to Recycle Bin
              </span>
            )}
          </label>
        ))}
      </div>
      <button
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={busy || selected.size === 0}
        onClick={() => void approve()}
      >
        Approve {selected.size} deletion{selected.size === 1 ? "" : "s"}
      </button>
      {message && <p className="text-sm">{message}</p>}
    </article>
  );
}
