import { describe, expect, it } from "vitest";
import { recommendKeep } from "@/lib/duplicates/recommend";

describe("duplicate keep recommendation", () => {
  it("prefers a canonical filename over an obvious copy", () => {
    expect(recommendKeep([
      { id: "a", driveItemId: "a", name: "IMG_1000.jpg", path: "/Pictures/IMG_1000.jpg", remoteCreatedAt: 20 },
      { id: "b", driveItemId: "b", name: "IMG_1000 (1).jpg", path: "/Pictures/IMG_1000 (1).jpg", remoteCreatedAt: 10 },
    ])).toBe("a");
  });

  it("avoids Downloads when filenames are otherwise equivalent", () => {
    expect(recommendKeep([
      { id: "a", driveItemId: "a", name: "photo.jpg", path: "/Pictures/photo.jpg", remoteCreatedAt: 20 },
      { id: "b", driveItemId: "b", name: "photo.jpg", path: "/Downloads/photo.jpg", remoteCreatedAt: 10 },
    ])).toBe("a");
  });
});
