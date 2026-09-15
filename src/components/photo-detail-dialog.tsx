"use client";

import { PhotoThumb } from "@/components/photo-thumb";
import { Button } from "@/components/ui/button";
import { MetadataRow } from "@/components/ui/metadata-row";
import {
  formatAperture,
  formatBytes,
  formatCamera,
  formatDateTime,
  formatDimensions,
  formatExposure,
  formatFocalLength,
} from "@/lib/photos/format";
import type { PhotoMetadata } from "@/lib/photos/types";

export function PhotoDetailDialog({ photo, onClose }: { photo: PhotoMetadata; onClose: () => void }) {
  const rows: Array<[string, string | null]> = [
    ["Path", photo.path || null],
    ["Size", formatBytes(photo.sizeBytes)],
    ["Type", photo.mimeType],
    ["Dimensions", formatDimensions(photo.width, photo.height)],
    ["Captured", formatDateTime(photo.takenAt)],
    ["Created", formatDateTime(photo.remoteCreatedAt)],
    ["Modified", formatDateTime(photo.remoteModifiedAt)],
    ["Camera", formatCamera(photo.cameraMake, photo.cameraModel)],
    ["Aperture", formatAperture(photo.fNumber)],
    ["Exposure", formatExposure(photo.exposureNumerator, photo.exposureDenominator)],
    ["Focal length", formatFocalLength(photo.focalLength)],
    ["ISO", photo.iso !== null ? `ISO ${photo.iso}` : null],
    ["Orientation", photo.orientation !== null ? String(photo.orientation) : null],
    ["ETag", photo.etag],
    ["QuickXorHash", photo.quickxorHash],
    ["SHA-256", photo.sha256],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${photo.name} details`}
        className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 p-5">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-zinc-100">{photo.name}</h2>
            <p className="mt-1 break-all text-xs text-zinc-500">{photo.path}</p>
          </div>
          <Button type="button" variant="ghost" aria-label="Close details" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <PhotoThumb photoId={photo.photoId} alt={photo.name} className="w-full rounded-xl" />
          <dl className="min-w-0 rounded-xl border border-zinc-900 bg-black/20 px-4">
            {rows.map(([label, value]) => value ? (
              <MetadataRow key={label} label={label}>{value}</MetadataRow>
            ) : null)}
          </dl>
        </div>
      </section>
    </div>
  );
}
