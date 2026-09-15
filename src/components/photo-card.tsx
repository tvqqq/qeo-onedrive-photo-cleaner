"use client";

import type { ReactNode } from "react";
import { PhotoThumb } from "@/components/photo-thumb";
import { Card } from "@/components/ui/card";
import {
  formatBytes,
  formatCamera,
  formatDateTime,
  formatDimensions,
} from "@/lib/photos/format";
import type { PhotoMetadata } from "@/lib/photos/types";

export function PhotoCard({
  photo,
  onOpen,
  children,
}: {
  photo: PhotoMetadata;
  onOpen?: () => void;
  children?: ReactNode;
}) {
  const dimensions = formatDimensions(photo.width, photo.height);
  const camera = formatCamera(photo.cameraMake, photo.cameraModel);
  const captured = formatDateTime(photo.takenAt);

  const content = (
    <>
      <PhotoThumb photoId={photo.photoId} alt={photo.name} className="w-full rounded-none" />
      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-zinc-100" title={photo.name}>
            {photo.name}
          </h3>
          <p className="mt-1 truncate text-xs text-zinc-500" title={photo.path}>
            {photo.path}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
          {dimensions ? <span>{dimensions}</span> : null}
          <span>{formatBytes(photo.sizeBytes)}</span>
          {camera ? <span>{camera}</span> : null}
          {captured ? <span>{captured}</span> : null}
        </div>
      </div>
    </>
  );

  return (
    <Card className="overflow-hidden">
      {onOpen ? (
        <button
          type="button"
          aria-label={`Open ${photo.name} details`}
          onClick={onOpen}
          className="block w-full text-left transition hover:bg-zinc-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          {content}
        </button>
      ) : content}
      {children ? <div className="border-t border-zinc-800 p-4">{children}</div> : null}
    </Card>
  );
}
