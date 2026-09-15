import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { CATEGORY_NAMES, TAXONOMY } from "@/lib/classification/taxonomy";
import type { PhotoQuery, PhotoSort } from "@/lib/photos/types";

const SORT_OPTIONS: Array<[PhotoSort, string]> = [
  ["taken-desc", "Captured: newest"],
  ["taken-asc", "Captured: oldest"],
  ["modified-desc", "Modified: newest"],
  ["modified-asc", "Modified: oldest"],
  ["size-desc", "Size: largest"],
  ["size-asc", "Size: smallest"],
  ["name-asc", "Name: A–Z"],
  ["name-desc", "Name: Z–A"],
];

function dateInputValue(value?: number) {
  return value === undefined ? "" : new Date(value).toISOString().slice(0, 10);
}

const fieldClass = "mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-sky-400";

export function PhotosFilterBar({ query }: { query: PhotoQuery }) {
  return (
    <form method="get" className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 md:grid-cols-2 xl:grid-cols-6">
      <label className="text-xs font-medium text-zinc-400 xl:col-span-2">
        Search
        <input name="q" type="search" defaultValue={query.search ?? ""} placeholder="Filename, path, camera…" className={fieldClass} />
      </label>

      <label className="text-xs font-medium text-zinc-400">
        Type
        <select name="mime" defaultValue={query.mimeType ?? "all"} className={fieldClass}>
          <option value="all">All images</option>
          <option value="image/jpeg">JPEG</option>
          <option value="image/png">PNG</option>
          <option value="image/heic">HEIC</option>
          <option value="image/webp">WebP</option>
        </select>
      </label>

      <label className="text-xs font-medium text-zinc-400">
        Category
        <select name="category" defaultValue={query.category ?? ""} className={fieldClass}>
          <option value="">All categories</option>
          {TAXONOMY.map((slug) => <option key={slug} value={slug}>{CATEGORY_NAMES[slug]}</option>)}
        </select>
      </label>

      <label className="text-xs font-medium text-zinc-400">
        From
        <input name="from" type="date" defaultValue={dateInputValue(query.takenFrom)} className={fieldClass} />
      </label>

      <label className="text-xs font-medium text-zinc-400">
        To
        <input name="to" type="date" defaultValue={dateInputValue(query.takenTo)} className={fieldClass} />
      </label>

      <label className="text-xs font-medium text-zinc-400 xl:col-span-2">
        Sort
        <select name="sort" defaultValue={query.sort} className={fieldClass}>
          {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <div className="flex items-end gap-2 xl:col-span-4">
        <button type="submit" className={buttonClass("primary")}>Apply filters</button>
        <Link href="/photos" className={buttonClass("ghost")}>Clear</Link>
      </div>
    </form>
  );
}
