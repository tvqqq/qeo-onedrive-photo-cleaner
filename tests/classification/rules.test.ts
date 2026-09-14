import { describe, expect, it } from "vitest";
import { TAXONOMY } from "@/lib/classification/taxonomy";
import { classifyByRule } from "@/lib/classification/rules";

describe("classification taxonomy and deterministic rules", () => {
  it("uses the fixed v0.1 taxonomy", () => {
    expect(TAXONOMY).toEqual([
      "family", "kids", "couple", "friends", "travel", "food", "pets", "work",
      "documents", "screenshots", "home", "events", "nature", "vehicles", "shopping",
      "memes", "other",
    ]);
  });

  it("classifies screenshot paths before model inference", () => {
    expect(classifyByRule({ name: "Screenshot 2026-09-14.png", path: "/Pictures/Screenshots/Screenshot 2026-09-14.png" }))
      .toEqual([{ slug: "screenshots", confidence: 1, source: "rule" }]);
  });

  it("recognizes strong document filenames but leaves ordinary photos to the model", () => {
    expect(classifyByRule({ name: "invoice-2026.jpg", path: "/Pictures/invoice-2026.jpg" })[0]?.slug).toBe("documents");
    expect(classifyByRule({ name: "IMG_1234.jpg", path: "/Pictures/Camera Roll/IMG_1234.jpg" })).toEqual([]);
  });
});
