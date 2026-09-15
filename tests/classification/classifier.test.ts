import { describe, expect, it, vi } from "vitest";
import { ZeroShotClassifier } from "@/lib/classification/classifier";

describe("ZeroShotClassifier", () => {
  it("initializes once and reuses the classifier for later classifications", async () => {
    const classify = vi.fn().mockResolvedValue([{ label: "travel", score: 0.9 }]);
    const factory = vi.fn().mockResolvedValue(classify);
    const service = new ZeroShotClassifier(factory);

    await service.initialize();
    const first = await service.classify("/tmp/a.jpg", ["travel", "food"]);
    await service.classify("/tmp/b.jpg", ["travel", "food"]);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(classify).toHaveBeenNthCalledWith(1, "/tmp/a.jpg", ["travel", "food"]);
    expect(first).toEqual([{ label: "travel", score: 0.9 }]);
  });

  it("surfaces classifier startup failure from initialize", async () => {
    const factory = vi.fn().mockRejectedValue(new Error("model startup failed"));
    const service = new ZeroShotClassifier(factory);

    await expect(service.initialize()).rejects.toThrow("model startup failed");
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
