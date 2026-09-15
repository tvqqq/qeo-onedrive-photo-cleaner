"use client";

import { AlbumPicker } from "@/components/album-picker";
import { DeletePhotoControl } from "@/components/delete-photo-control";
import { PhotoTagsEditor } from "@/components/photo-tags-editor";
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
  formatSourceIdentity,
} from "@/lib/photos/format";
import type { PhotoMetadata } from "@/lib/photos/types";
import type { PhotoTag } from "@/lib/tags/types";

export function PhotoDetailDialog({
  photo,
  onClose,
  onTagsChange,
  onDeleted,
}: {
  photo: PhotoMetadata;
  onClose: () => void;
  onTagsChange(tags: PhotoTag[]): void;
  onDeleted(photoId: string): void;
}) {
  const createdBy = formatSourceIdentity({
    deviceName: photo.createdByDeviceName,
    applicationName: photo.createdByApplicationName,
    userName: photo.createdByUserName,
  });
  const modifiedBy = formatSourceIdentity({
    deviceName: photo.modifiedByDeviceName,
    applicationName: photo.modifiedByApplicationName,
    userName: photo.modifiedByUserName,
  });
  const metadata: Array<[string, string | null]> = [
    ["Path", photo.path || null],
    ["Size", formatBytes(photo.sizeBytes)],
    ["Type", photo.mimeType],
    ["Dimensions", formatDimensions(photo.width, photo.height)],
    ["Captured", formatDateTime(photo.takenAt)],
    ["Created", formatDateTime(photo.remoteCreatedAt)],
    ["Modified", formatDateTime(photo.remoteModifiedAt)],
    ["Uploaded/created by", createdBy],
    ["Last modified by", modifiedBy],
    ["Camera", formatCamera(photo.cameraMake, photo.cameraModel)],
    ["Aperture", formatAperture(photo.fNumber)],
    ["Exposure", formatExposure(photo.exposureNumerator, photo.exposureDenominator)],
    ["Focal length", formatFocalLength(photo.focalLength)],
    ["ISO", photo.iso !== null ? `ISO ${photo.iso}` : null],
    ["Orientation", photo.orientation !== null ? String(photo.orientation) : null],
  ];
  const technical: Array<[string, string | null]> = [
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
          <Button type="button" variant="ghost" aria-label="Close details" onClick={onClose}>Close</Button>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <PhotoThumb photoId={photo.photoId} alt={photo.name} className="w-full rounded-xl" />
          <div className="min-w-0 space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-100">Tags</h3>
              <PhotoTagsEditor photoId={photo.photoId} tags={photo.tags ?? []} onTagsChange={onTagsChange} />
            </section>

            <section className="space-y-2 border-t border-zinc-900 pt-4">
              <h3 className="text-sm font-semibold text-zinc-100">Album</h3>
              <AlbumPicker photoId={photo.photoId} />
            </section>

            <section className="space-y-2 border-t border-zinc-900 pt-4">
              <h3 className="text-sm font-semibold text-zinc-100">Metadata</h3>
              <dl className="rounded-xl border border-zinc-900 bg-black/20 px-4">
                {metadata.map(([label, value]) => value ? <MetadataRow key={label} label={label}>{value}</MetadataRow> : null)}
              </dl>
            </section>

            <section className="space-y-2 border-t border-zinc-900 pt-4">
              <h3 className="text-sm font-semibold text-zinc-100">Technical</h3>
              <dl className="rounded-xl border border-zinc-900 bg-black/20 px-4">
                {technical.map(([label, value]) => value ? <MetadataRow key={label} label={label}>{value}</MetadataRow> : null)}
              </dl>
            </section>

            <section className="space-y-2 border-t border-zinc-900 pt-4">
              <h3 className="text-sm font-semibold text-red-200">Danger zone</h3>
              <DeletePhotoControl photoId={photo.photoId} filename={photo.name} onDeleted={onDeleted} />
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
