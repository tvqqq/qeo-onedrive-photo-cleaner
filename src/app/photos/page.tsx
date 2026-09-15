import Link from "next/link";
import { PhotosFilterBar } from "@/components/photos-filter-bar";
import { PhotosGrid } from "@/components/photos-grid";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { normalizePhotoQuery } from "@/lib/photos/query";
import { listPhotos } from "@/lib/photos/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pageHref(
  params: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else {
      search.set(key, value);
    }
  }
  search.set("page", String(page));
  return `/photos?${search.toString()}`;
}

export default async function PhotosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = normalizePhotoQuery(params);
  const db = openAppDatabase();
  let result;

  try {
    migrateDatabase(db);
    result = listPhotos(db, query);
  } finally {
    db.close();
  }

  const first = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.page * result.pageSize, result.total);

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Library"
        title="Photos"
        description="Browse your indexed OneDrive photo library with server-side search, filters, sorting, and rich Graph metadata."
      />

      <PhotosFilterBar query={query} />

      <div className="flex flex-col gap-2 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <p>{result.total === 0 ? "0 photos" : `Showing ${first}–${last} of ${result.total} photos`}</p>
        <p>Page {result.page} of {Math.max(result.totalPages, 1)}</p>
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-sm text-zinc-400">
          No photos match these filters.
        </div>
      ) : (
        <PhotosGrid photos={result.items} />
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Photos pagination" className="flex items-center justify-between gap-3 border-t border-zinc-900 pt-5">
          {result.page > 1 ? (
            <Link href={pageHref(params, result.page - 1)} className={buttonClass("secondary")}>Previous</Link>
          ) : <span />}
          {result.page < result.totalPages ? (
            <Link href={pageHref(params, result.page + 1)} className={buttonClass("secondary")}>Next</Link>
          ) : <span />}
        </nav>
      ) : null}
    </main>
  );
}
