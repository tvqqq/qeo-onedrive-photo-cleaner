import { PhotoCard } from "@/components/photo-card";
import { Badge } from "@/components/ui/badge";
import type { PhotoMetadata } from "@/lib/photos/types";

export interface SimilarCardItem {
  photo: PhotoMetadata;
}

export function SimilarGroupCard({
  confidence,
  items,
}: {
  confidence: number | null;
  items: SimilarCardItem[];
}) {
  return (
    <article className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="warning">Heuristic — review only</Badge>
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{items.length} photos</span>
        </div>
        {confidence !== null ? (
          <span className="text-sm text-zinc-400">Similarity {Math.round(confidence * 100)}%</span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <PhotoCard key={item.photo.photoId} photo={item.photo} />
        ))}
      </div>

      <p className="rounded-xl border border-amber-950/70 bg-amber-950/20 p-4 text-xs leading-5 text-amber-200/80">
        Visual similarity is a local heuristic, not proof of duplication. This section is comparison-only and exposes no destructive action.
      </p>
    </article>
  );
}
