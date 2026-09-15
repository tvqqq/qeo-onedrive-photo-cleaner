"use client";

import { useState } from "react";

export function PhotoThumb({ photoId, alt, className = "" }: { photoId: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex aspect-square items-center justify-center bg-zinc-900 px-4 text-center text-xs text-zinc-500 ${className}`}
      >
        Thumbnail unavailable
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/thumbnails/${encodeURIComponent(photoId)}`}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`aspect-square object-cover ${className}`}
    />
  );
}
