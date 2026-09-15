import { DuplicateGroupCard } from "@/components/duplicate-group-card";
import { FindSimilarButton } from "@/components/find-similar-button";
import { SimilarGroupCard } from "@/components/similar-group-card";
import { PageHeader } from "@/components/ui/page-header";
import { VerifyExactButton } from "@/components/verify-exact-button";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import {
  listPendingDuplicateReviewGroups,
  type DuplicateReviewGroup,
} from "@/lib/duplicates/review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExactGroup = Extract<DuplicateReviewGroup, { type: "exact" }>;
type SimilarGroup = Extract<DuplicateReviewGroup, { type: "similar" }>;

export default function DuplicatesPage() {
  const db = openAppDatabase();
  let groups: DuplicateReviewGroup[];
  try {
    migrateDatabase(db);
    groups = listPendingDuplicateReviewGroups(db);
  } finally {
    db.close();
  }

  const exactGroups = groups.filter((group): group is ExactGroup => group.type === "exact");
  const similarGroups = groups.filter((group): group is SimilarGroup => group.type === "similar");

  return (
    <main className="mx-auto max-w-[1500px] space-y-10 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Review"
        title="Duplicates"
        description="Verified exact duplicates use matching streamed SHA-256 content. Similar photos are local visual heuristics and remain comparison-only."
      />

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold text-zinc-100">Verified exact duplicates</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              QuickXorHash only narrows candidates. Exact groups appear here only after streamed SHA-256 verification, and deletion still requires explicit review.
            </p>
          </div>
          <VerifyExactButton />
        </div>

        {exactGroups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-sm text-zinc-400">
            No verified exact groups waiting for review.
          </p>
        ) : (
          <div className="space-y-5">
            {exactGroups.map((group) => (
              <DuplicateGroupCard
                key={group.id}
                groupId={group.id}
                verifiedSha256={group.verifiedSha256}
                items={group.items}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5 border-t border-zinc-900 pt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold text-zinc-100">Similar photos</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              dHash narrows candidates, then local CLIP embeddings estimate visual similarity. These groups never expose a delete action.
            </p>
          </div>
          <FindSimilarButton />
        </div>

        {similarGroups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-sm text-zinc-400">
            No similar-photo groups waiting for review.
          </p>
        ) : (
          <div className="space-y-5">
            {similarGroups.map((group) => (
              <SimilarGroupCard key={group.id} confidence={group.confidence} items={group.items} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
