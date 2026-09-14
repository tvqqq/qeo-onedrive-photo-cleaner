import Link from "next/link";
import { CategoryReviewCard } from "@/components/category-review-card";
import { ClassifyPhotosButton } from "@/components/classify-photos-button";
import { listCategoryReviewQueue } from "@/lib/classification/service";
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
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <Link className="text-sm underline" href="/">← Dashboard</Link>
        <h1 className="mt-4 text-2xl font-semibold">Category review</h1>
        <p className="mt-2 text-sm text-gray-600">
          Suggestions run locally. Review and correct labels before they are used for OneDrive album sync.
        </p>
      </div>

      <ClassifyPhotosButton />

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
