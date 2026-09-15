"use client";

import { useState } from "react";
import { PhotoCard } from "@/components/photo-card";
import { PhotoDetailDialog } from "@/components/photo-detail-dialog";
import type { PhotoMetadata } from "@/lib/photos/types";

export function PhotosGrid({ photos }: { photos: PhotoMetadata[] }) {
  const [selected, setSelected] = useState<PhotoMetadata | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photos.map((photo) => (
          <PhotoCard key={photo.photoId} photo={photo} onOpen={() => setSelected(photo)} />
        ))}
      </div>
      {selected ? <PhotoDetailDialog photo={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
