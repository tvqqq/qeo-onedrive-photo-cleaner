import { describe, expect, it, vi } from "vitest";
import { ClipService, cosineSimilarity, normalizeEmbedding } from "@/lib/classification/clip";

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

  it("loads the image feature extractor once and normalizes its output", async () => {
    const extractor = vi.fn().mockResolvedValue({ data: new Float32Array([3, 4]) });
    const factory = vi.fn().mockResolvedValue(extractor);
    const service = new ClipService(factory);

    const first = await service.embedImage("/tmp/a.jpg");
    const second = await service.embedImage("/tmp/b.jpg");

    expect(factory).toHaveBeenCalledTimes(1);
    expect(extractor).toHaveBeenCalledTimes(2);
    expect(first[0]).toBeCloseTo(0.6);
    expect(first[1]).toBeCloseTo(0.8);
    expect(second[0]).toBeCloseTo(0.6);
  });
});
