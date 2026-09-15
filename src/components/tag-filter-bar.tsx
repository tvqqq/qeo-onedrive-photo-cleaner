"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parsePhotoSearch } from "@/lib/photos/query";
import type { TagCount } from "@/lib/tags/types";

export function TagFilterBar({ tags }: { tags: TagCount[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parsed = parsePhotoSearch(searchParams.get("q") ?? undefined);
  const activeTags = new Set(parsed.tagSlugs);

  function toggleTag(slug: string) {
    const nextTags = parsed.tagSlugs.filter((tag) => tag !== slug);
    if (!activeTags.has(slug)) nextTags.push(slug);

    const nextQuery = [
      parsed.text,
      ...nextTags.map((tag) => `#${tag}`),
    ].filter(Boolean).join(" ");

    const next = new URLSearchParams(searchParams.toString());
    if (nextQuery) next.set("q", nextQuery);
    else next.delete("q");
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Popular tags">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tags</span>
      {tags.map((tag) => {
        const active = activeTags.has(tag.slug);
        return (
          <button
            key={tag.slug}
            type="button"
            aria-pressed={active}
            onClick={() => toggleTag(tag.slug)}
            className={active
              ? "rounded-full border border-sky-700 bg-sky-950/60 px-3 py-1 text-xs text-sky-200 transition hover:border-sky-500"
              : "rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-white"}
          >
            #{tag.name} <span className={active ? "text-sky-500" : "text-zinc-500"}>{tag.count}</span>
          </button>
        );
      })}
    </div>
  );
}
