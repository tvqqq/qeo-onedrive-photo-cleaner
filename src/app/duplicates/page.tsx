import Link from "next/link";
import { DuplicateGroupCard, type DuplicateCardItem } from "@/components/duplicate-group-card";
import { VerifyExactButton } from "@/components/verify-exact-button";
import { openAppDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  group_id: string;
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
      SELECT dgi.group_id, dgi.photo_id, p.name, p.path, p.size_bytes,
             dgi.recommended_keep, dgi.selected_for_delete
      FROM duplicate_groups dg
      JOIN duplicate_group_items dgi ON dgi.group_id = dg.id
      JOIN photos p ON p.id = dgi.photo_id
      WHERE dg.type = 'exact' AND dg.status = 'pending' AND p.deleted_remote_at IS NULL
      ORDER BY dg.created_at DESC, dgi.recommended_keep DESC, p.name
    `).all() as Row[];
  } finally {
    db.close();
  }

  const grouped = new Map<string, DuplicateCardItem[]>();
  for (const row of rows) {
    const items = grouped.get(row.group_id) ?? [];
    items.push({
      photoId: row.photo_id,
      name: row.name,
      path: row.path,
      sizeBytes: row.size_bytes,
      recommendedKeep: Boolean(row.recommended_keep),
      selectedForDelete: Boolean(row.selected_for_delete),
    });
    grouped.set(row.group_id, items);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <Link className="text-sm underline" href="/">← Dashboard</Link>
        <h1 className="mt-4 text-2xl font-semibold">Verified exact duplicates</h1>
        <p className="mt-2 text-sm text-gray-600">QuickXorHash only finds candidates. Every group below has matching streamed SHA-256 content.</p>
      </div>
      <VerifyExactButton />
      {grouped.size === 0 ? <p className="rounded-lg border p-5 text-sm text-gray-600">No verified exact groups yet.</p> : null}
      {[...grouped.entries()].map(([groupId, items]) => <DuplicateGroupCard key={groupId} groupId={groupId} items={items} />)}
    </main>
  );
}
