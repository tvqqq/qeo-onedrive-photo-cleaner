import { describe, expect, it, vi } from "vitest";
import { ZeroShotClassifier } from "@/lib/classification/classifier";

describe("ZeroShotClassifier", () => {
  it("loads once and forwards local image path with candidate labels", async () => {
    const classify = vi.fn().mockResolvedValue([{ label: "travel", score: 0.9 }]);
    const factory = vi.fn().mockResolvedValue(classify);
    const service = new ZeroShotClassifier(factory);

    const first = await service.classify("/tmp/a.jpg", ["travel", "food"]);
    await service.classify("/tmp/b.jpg", ["travel", "food"]);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(classify).toHaveBeenNthCalledWith(1, "/tmp/a.jpg", ["travel", "food"]);
    expect(first).toEqual([{ label: "travel", score: 0.9 }]);
  });
});
