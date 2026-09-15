import type { ReactNode } from "react";

export function MetadataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-zinc-900 py-2.5 last:border-b-0">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm text-zinc-200">{children}</dd>
    </div>
  );
}
