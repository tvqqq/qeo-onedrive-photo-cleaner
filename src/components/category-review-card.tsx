"use client";

import { useState } from "react";
import { PhotoCard } from "@/components/photo-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORY_NAMES, TAXONOMY, type CategorySlug } from "@/lib/classification/taxonomy";
import type { PhotoMetadata } from "@/lib/photos/types";

export interface CategoryReviewLabel {
  slug: CategorySlug;
  name: string;
  source: string;
  confidence: number | null;
}

export function CategoryReviewCard({
  photo,
  selectedSlugs,
  labels,
}: {
  photo: PhotoMetadata;
  selectedSlugs: CategorySlug[];
  labels: CategoryReviewLabel[];
}) {
  const initial = new Set<CategorySlug>(selectedSlugs);
  const [selected, setSelected] = useState(() => new Set(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(slug: CategorySlug) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function save() {
    const add = TAXONOMY.filter((slug) => selected.has(slug) && !initial.has(slug));
    const remove = TAXONOMY.filter((slug) => initial.has(slug) && !selected.has(slug));
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/categories/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "review", photoId: photo.photoId, add, remove, markReviewed: true }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Unable to save review");
      setMessage("Reviewed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PhotoCard photo={photo}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone="warning">Needs review</Badge>
          <span className="text-xs text-zinc-500">Choose the categories that should remain after review.</span>
        </div>

        {labels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <span
                key={label.slug}
                className="rounded-full border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-xs text-zinc-300"
              >
                {label.name} · {label.source}
                {label.confidence === null ? "" : ` · ${Math.round(label.confidence * 100)}%`}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No suggested labels yet.</p>
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TAXONOMY.map((slug) => (
            <label
              key={slug}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-700"
            >
              <input
                type="checkbox"
                checked={selected.has(slug)}
                onChange={() => toggle(slug)}
                className="h-4 w-4 accent-sky-400"
              />
              {CATEGORY_NAMES[slug]}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save & mark reviewed"}
          </Button>
          {message ? <span role="status" className="text-sm text-zinc-300">{message}</span> : null}
        </div>
      </div>
    </PhotoCard>
  );
}
