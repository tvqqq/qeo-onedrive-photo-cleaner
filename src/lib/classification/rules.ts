import type { CategorySlug } from "@/lib/classification/taxonomy";

export interface ClassificationSuggestion {
  slug: CategorySlug;
  confidence: number;
  source: "rule" | "local-ai";
}

export interface RulePhotoInput {
  name: string;
  path: string;
}

const SCREENSHOT_RE = /(?:^|[\s_\-/])(screenshot|screen[\s_-]?shot)(?:[\s_.\-/]|$)/i;
const DOCUMENT_RE = /(?:^|[\s_\-])(invoice|receipt|document|statement|bill|scan|scanned)(?:[\s_.\-]|$)/i;

export function classifyByRule(photo: RulePhotoInput): ClassificationSuggestion[] {
  const haystack = `${photo.path}/${photo.name}`;
  if (SCREENSHOT_RE.test(haystack)) {
    return [{ slug: "screenshots", confidence: 1, source: "rule" }];
  }
  if (DOCUMENT_RE.test(photo.name)) {
    return [{ slug: "documents", confidence: 1, source: "rule" }];
  }
  return [];
}
