import Link from "next/link";
import { CategoryReviewCard } from "@/components/category-review-card";
import { ClassifyPhotosButton } from "@/components/classify-photos-button";
import { SyncAlbumButton } from "@/components/sync-album-button";
import { listCategoryReviewQueue } from "@/lib/classification/service";
import { CATEGORY_NAMES, TAXONOMY } from "@/lib/classification/taxonomy";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function CategoriesPage() {
  const db = openAppDatabase();
  let items;
  try {
    migrateDatabase(db);
    items = listCategoryReviewQueue(db, 50);
  } finally {
    db.close();
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <div>
        <Link className="text-sm underline" href="/">← Dashboard</Link>
        <h1 className="mt-4 text-2xl font-semibold">Category review</h1>
        <p className="mt-2 text-sm text-gray-600">
          Suggestions run locally. Review and correct labels before they are used for OneDrive album sync.
        </p>
      </div>

      <ClassifyPhotosButton />

      <section className="space-y-3 rounded-xl border bg-white p-5">
        <div>
          <h2 className="font-medium">OneDrive albums</h2>
          <p className="mt-1 text-sm text-gray-600">
            Sync adds reviewed, non-deleted photos only. v0.1 never removes existing album members automatically.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {TAXONOMY.filter((slug) => slug !== "other").map((slug) => (
            <SyncAlbumButton key={slug} categoryId={slug} categoryName={CATEGORY_NAMES[slug]} />
          ))}
        </div>
      </section>

      {items.length === 0 ? (
        <p className="rounded-lg border p-5 text-sm text-gray-600">
          No photos waiting for category review.
        </p>
      ) : null}

      <section className="space-y-4">
        {items.map((item) => (
          <CategoryReviewCard
            key={item.photoId}
            photo={{ photoId: item.photoId, name: item.name, path: item.path }}
            selectedSlugs={item.labels.map((label) => label.slug)}
            labels={item.labels}
          />
        ))}
      </section>
    </main>
  );
}
