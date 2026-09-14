export function PhotoThumb({ photoId, alt, className = "" }: { photoId: string; alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/thumbnails/${encodeURIComponent(photoId)}`}
      alt={alt}
      loading="lazy"
      className={`aspect-square rounded-md object-cover ${className}`}
    />
  );
}
