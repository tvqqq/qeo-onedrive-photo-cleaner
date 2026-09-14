import { describe, expect, it } from "vitest";
import { cosineSimilarity, normalizeEmbedding } from "@/lib/classification/clip";

describe("CLIP vector helpers", () => {
  it("normalizes embeddings to unit length", () => {
    const normalized = normalizeEmbedding(new Float32Array([3, 4]));
    expect(normalized[0]).toBeCloseTo(0.6);
    expect(normalized[1]).toBeCloseTo(0.8);
  });

  it("scores identical directions above orthogonal directions", () => {
    const a = new Float32Array([1, 0]);
    expect(cosineSimilarity(a, new Float32Array([1, 0]))).toBeCloseTo(1);
    expect(cosineSimilarity(a, new Float32Array([0, 1]))).toBeCloseTo(0);
  });
});
