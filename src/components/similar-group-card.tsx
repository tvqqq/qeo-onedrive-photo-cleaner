import { PhotoThumb } from "./photo-thumb";

export interface SimilarCardItem {
  photoId: string;
  name: string;
  path: string;
  sizeBytes: number;
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function SimilarGroupCard({
  confidence,
  items,
}: {
  confidence: number | null;
  items: SimilarCardItem[];
}) {
  return (
    <article className="space-y-4 rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
          Heuristic — review only
        </span>
        {confidence !== null ? (
          <span className="text-sm text-gray-600">Similarity {Math.round(confidence * 100)}%</span>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.photoId} className="space-y-2 rounded-lg border p-3">
            <PhotoThumb photoId={item.photoId} alt={item.name} className="w-full" />
            <div className="text-sm">
              <p className="font-medium">{item.name}</p>
              <p className="truncate text-gray-500">{item.path}</p>
              <p className="text-gray-500">{formatBytes(item.sizeBytes)}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Similarity is a local heuristic, not proof of duplication. No file is preselected or deleted from this view.
      </p>
    </article>
  );
}
