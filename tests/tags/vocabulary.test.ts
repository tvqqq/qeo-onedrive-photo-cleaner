import { describe, expect, it } from "vitest";
import {
  TAG_MAX_AI_TAGS,
  TAG_MIN_SCORE,
  TAG_TAXONOMY_VERSION,
  TAG_VOCABULARY,
} from "@/lib/tags/vocabulary";

describe("Qeo AI tag vocabulary", () => {
  it("keeps the v1 vocabulary and scoring policy stable", () => {
    expect(TAG_TAXONOMY_VERSION).toBe("qeo-tags-v1");
    expect(TAG_MIN_SCORE).toBe(0.04);
    expect(TAG_MAX_AI_TAGS).toBe(5);
    expect(TAG_VOCABULARY).toHaveLength(80);
    expect(new Set(TAG_VOCABULARY.map((tag) => tag.slug)).size).toBe(80);
    expect(new Set(TAG_VOCABULARY.map((tag) => tag.prompt)).size).toBe(80);
    expect(TAG_VOCABULARY.find((tag) => tag.slug === "qr-code")?.name).toBe("QR Code");
    expect(TAG_VOCABULARY.find((tag) => tag.slug === "social-media")?.name).toBe("Social Media");
  });
});
