import Link from "next/link";
import type { TagCount } from "@/lib/tags/types";

function tagHref(slug: string) {
  const search = new URLSearchParams({ q: `#${slug}` });
  return `/photos?${search.toString()}`;
}

export function TagFilterBar({ tags }: { tags: TagCount[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Popular tags">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tags</span>
      {tags.map((tag) => (
        <Link
          key={tag.slug}
          href={tagHref(tag.slug)}
          className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-white"
        >
          #{tag.name} <span className="text-zinc-500">{tag.count}</span>
        </Link>
      ))}
    </div>
  );
}
