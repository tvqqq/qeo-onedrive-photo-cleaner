"use client";

import { useState } from "react";
import { PhotoCard } from "@/components/photo-card";
import { PhotoDetailDialog } from "@/components/photo-detail-dialog";
import type { PhotoMetadata } from "@/lib/photos/types";
import type { PhotoTag } from "@/lib/tags/types";

export function PhotosGrid({ photos }: { photos: PhotoMetadata[] }) {
  const [visiblePhotos, setVisiblePhotos] = useState(photos);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = visiblePhotos.find((photo) => photo.photoId === selectedId) ?? null;

  function updateTags(photoId: string, tags: PhotoTag[]) {
    setVisiblePhotos((items) => items.map((item) =>
      item.photoId === photoId ? { ...item, tags } : item,
    ));
  }

  function removePhoto(photoId: string) {
    setVisiblePhotos((items) => items.filter((item) => item.photoId !== photoId));
    setSelectedId(null);
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visiblePhotos.map((photo) => (
          <PhotoCard key={photo.photoId} photo={photo} onOpen={() => setSelectedId(photo.photoId)} />
        ))}
      </div>
      {selected ? (
        <PhotoDetailDialog
          photo={selected}
          onClose={() => setSelectedId(null)}
          onTagsChange={(tags) => updateTags(selected.photoId, tags)}
          onDeleted={removePhoto}
        />
      ) : null}
    </>
  );
}
