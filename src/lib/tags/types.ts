export interface PhotoTag {
  slug: string;
  name: string;
  source: "ai" | "manual";
  state: "active" | "removed";
  confidence: number | null;
}

export interface TagCount {
  slug: string;
  name: string;
  count: number;
}

export interface AiTagSuggestion {
  slug: string;
  confidence: number;
}

export interface TagStateInput {
  taggedEtag: string | null;
  modelId: string;
  taxonomyVersion: string;
  taggedAt: number;
}

export interface PhotoNeedingTags {
  id: string;
  driveItemId: string;
  etag: string | null;
}
