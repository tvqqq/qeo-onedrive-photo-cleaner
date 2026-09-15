"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  ["Dashboard", "/"],
  ["Photos", "/photos"],
  ["Scan", "/scan"],
  ["Duplicates", "/duplicates"],
  ["Categories", "/categories"],
  ["Settings", "/settings"],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b border-zinc-800/90 bg-black/25 p-4 backdrop-blur md:min-h-screen md:border-b-0 md:border-r md:p-5">
        <Link href="/" className="mb-5 block text-sm font-semibold tracking-wide text-zinc-100">
          Qeo Photo Cleaner
        </Link>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {NAV_ITEMS.map(([label, href]) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
