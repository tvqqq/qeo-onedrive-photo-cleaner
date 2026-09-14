"use client";

import { useState } from "react";
import { PhotoThumb } from "@/components/photo-thumb";
import { CATEGORY_NAMES, TAXONOMY, type CategorySlug } from "@/lib/classification/taxonomy";

export interface CategoryReviewPhoto {
  photoId: string;
  name: string;
  path: string;
}

export function CategoryReviewCard({
  photo,
  selectedSlugs,
}: {
  photo: CategoryReviewPhoto;
  selectedSlugs: CategorySlug[];
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
    <article className="grid gap-5 rounded-xl border bg-white p-5 md:grid-cols-[180px_1fr]">
      <PhotoThumb photoId={photo.photoId} alt={photo.name} className="w-full" />
      <div className="space-y-4">
        <div>
          <h2 className="font-medium">{photo.name}</h2>
          <p className="text-sm text-gray-500">{photo.path}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TAXONOMY.map((slug) => (
            <label key={slug} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(slug)}
                onChange={() => toggle(slug)}
              />
              {CATEGORY_NAMES[slug]}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save & mark reviewed
          </button>
          {message ? <span className="text-sm text-gray-600">{message}</span> : null}
        </div>
      </div>
    </article>
  );
}
