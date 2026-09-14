import Link from "next/link";
import { DuplicateGroupCard, type DuplicateCardItem } from "@/components/duplicate-group-card";
import { FindSimilarButton } from "@/components/find-similar-button";
import { SimilarGroupCard, type SimilarCardItem } from "@/components/similar-group-card";
import { VerifyExactButton } from "@/components/verify-exact-button";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  group_id: string;
  group_type: "exact" | "similar";
  confidence: number | null;
  photo_id: string;
  name: string;
  path: string;
  size_bytes: number;
  recommended_keep: number;
  selected_for_delete: number;
};

export default function DuplicatesPage() {
  const db = openAppDatabase();
  let rows: Row[];
  try {
    migrateDatabase(db);
    rows = db.prepare(`
      SELECT dg.id AS group_id, dg.type AS group_type, dg.confidence,
             dgi.photo_id, p.name, p.path, p.size_bytes,
             dgi.recommended_keep, dgi.selected_for_delete
      FROM duplicate_groups dg
      JOIN duplicate_group_items dgi ON dgi.group_id = dg.id
      JOIN photos p ON p.id = dgi.photo_id
      WHERE dg.status = 'pending' AND p.deleted_remote_at IS NULL
      ORDER BY dg.created_at DESC, dgi.recommended_keep DESC, p.name
    `).all() as Row[];
  } finally {
    db.close();
  }

  const exactGroups = new Map<string, DuplicateCardItem[]>();
  const similarGroups = new Map<string, { confidence: number | null; items: SimilarCardItem[] }>();

  for (const row of rows) {
    if (row.group_type === "exact") {
      const items = exactGroups.get(row.group_id) ?? [];
      items.push({
        photoId: row.photo_id,
        name: row.name,
        path: row.path,
        sizeBytes: row.size_bytes,
        recommendedKeep: Boolean(row.recommended_keep),
        selectedForDelete: Boolean(row.selected_for_delete),
      });
      exactGroups.set(row.group_id, items);
      continue;
    }

    const group = similarGroups.get(row.group_id) ?? { confidence: row.confidence, items: [] };
    group.items.push({
      photoId: row.photo_id,
      name: row.name,
      path: row.path,
      sizeBytes: row.size_bytes,
    });
    similarGroups.set(row.group_id, group);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-10 p-8">
      <div>
        <Link className="text-sm underline" href="/">← Dashboard</Link>
        <h1 className="mt-4 text-2xl font-semibold">Duplicate review</h1>
        <p className="mt-2 text-sm text-gray-600">
          Exact groups are cryptographically verified. Similar groups are local heuristics and always require review.
        </p>
      </div>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Verified exact duplicates</h2>
          <p className="mt-1 text-sm text-gray-600">
            QuickXorHash only finds candidates. Every group below has matching streamed SHA-256 content.
          </p>
        </div>
        <VerifyExactButton />
        {exactGroups.size === 0 ? (
          <p className="rounded-lg border p-5 text-sm text-gray-600">No verified exact groups yet.</p>
        ) : null}
        {[...exactGroups.entries()].map(([groupId, items]) => (
          <DuplicateGroupCard key={groupId} groupId={groupId} items={items} />
        ))}
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Similar photos</h2>
          <p className="mt-1 text-sm text-gray-600">
            dHash narrows candidates, then a local CLIP embedding confirms visual similarity. Nothing here is auto-selected for deletion.
          </p>
        </div>
        <FindSimilarButton />
        {similarGroups.size === 0 ? (
          <p className="rounded-lg border p-5 text-sm text-gray-600">No similar-photo groups yet.</p>
        ) : null}
        {[...similarGroups.entries()].map(([groupId, group]) => (
          <SimilarGroupCard key={groupId} confidence={group.confidence} items={group.items} />
        ))}
      </section>
    </main>
  );
}
