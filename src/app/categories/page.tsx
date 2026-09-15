import { CategoryReviewCard } from "@/components/category-review-card";
import { ClassifyPhotosButton } from "@/components/classify-photos-button";
import { SyncAlbumButton } from "@/components/sync-album-button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
    <main className="mx-auto max-w-[1500px] space-y-8 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Organize"
        title="Category review"
        description="Suggestions run locally. Review labels against the photo metadata before approved categories are used for OneDrive album sync."
      />

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold text-zinc-100">Local classification</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Rules run first, then the local CLIP model can suggest labels for photos that still need classification.
            </p>
          </div>
          <ClassifyPhotosButton />
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">OneDrive albums</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            Current safety policy is add-only: sync adds reviewed, non-deleted photos and never automatically removes existing album members.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TAXONOMY.filter((slug) => slug !== "other").map((slug) => (
            <SyncAlbumButton key={slug} categoryId={slug} categoryName={CATEGORY_NAMES[slug]} />
          ))}
        </div>
      </Card>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Photos waiting for review</h2>
            <p className="mt-1 text-sm text-zinc-500">Showing up to 50 unreviewed photos at a time.</p>
          </div>
          <span className="text-sm text-zinc-500">{items.length} pending</span>
        </div>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-sm text-zinc-400">
            No photos waiting for category review.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <CategoryReviewCard
                key={item.photo.photoId}
                photo={item.photo}
                selectedSlugs={item.labels.map((label) => label.slug)}
                labels={item.labels}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
