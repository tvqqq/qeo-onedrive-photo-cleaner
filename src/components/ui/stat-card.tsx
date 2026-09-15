import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-zinc-400">{label}</p>
        {icon ? <span className="text-zinc-500">{icon}</span> : null}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">{value}</div>
      {hint ? <p className="mt-2 text-xs leading-5 text-zinc-500">{hint}</p> : null}
    </div>
  );
}
