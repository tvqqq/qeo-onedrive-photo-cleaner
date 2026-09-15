import { isCategorySlug } from "@/lib/classification/taxonomy";
import type { PhotoQuery, PhotoSort } from "./types";

const SORTS = new Set<PhotoSort>([
  "taken-desc",
  "taken-asc",
  "modified-desc",
  "modified-asc",
  "size-desc",
  "size-asc",
  "name-asc",
  "name-desc",
]);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDateBoundary(value: string | undefined, endOfDay = false): number | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  const parsed = Date.parse(`${value}${suffix}`);
  if (!Number.isFinite(parsed)) return undefined;
  const date = new Date(parsed);
  if (date.toISOString().slice(0, 10) !== value) return undefined;
  return parsed;
}

export function normalizePhotoQuery(
  params: Record<string, string | string[] | undefined>,
): PhotoQuery {
  const rawPage = Number(first(params.page));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;

  const rawSort = first(params.sort);
  const sort: PhotoSort = rawSort && SORTS.has(rawSort as PhotoSort)
    ? rawSort as PhotoSort
    : "taken-desc";

  const rawSearch = first(params.q)?.trim().slice(0, 120);
  const rawMime = first(params.mime)?.trim();
  const rawCategory = first(params.category)?.trim();
  const takenFrom = parseDateBoundary(first(params.from));
  const takenTo = parseDateBoundary(first(params.to), true);

  return {
    page,
    pageSize: 60,
    sort,
    category: rawCategory && isCategorySlug(rawCategory) ? rawCategory : undefined,
    ...(rawSearch ? { search: rawSearch } : {}),
    ...(rawMime && rawMime !== "all" && rawMime.startsWith("image/") ? { mimeType: rawMime } : {}),
    ...(takenFrom !== undefined ? { takenFrom } : {}),
    ...(takenTo !== undefined ? { takenTo } : {}),
  };
}
