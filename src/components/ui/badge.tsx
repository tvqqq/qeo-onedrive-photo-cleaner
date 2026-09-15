import type { ReactNode } from "react";

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "border-zinc-700 bg-zinc-900 text-zinc-300",
  info: "border-sky-900/80 bg-sky-950/60 text-sky-200",
  success: "border-emerald-900/80 bg-emerald-950/60 text-emerald-200",
  warning: "border-amber-900/80 bg-amber-950/60 text-amber-200",
  danger: "border-red-900/80 bg-red-950/60 text-red-200",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
