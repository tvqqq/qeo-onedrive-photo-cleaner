export interface NormalizedTagInput {
  name: string;
  slug: string;
}

export function normalizeTagInput(raw: string): NormalizedTagInput {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length > 80) throw new Error("Tag name must be 80 characters or fewer");

  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) throw new Error("Tag must contain at least one letter or number");
  return { name, slug };
}
