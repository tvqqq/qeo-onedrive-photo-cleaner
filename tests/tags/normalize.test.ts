import { describe, expect, it } from "vitest";
import { normalizeTagInput } from "@/lib/tags/normalize";

describe("normalizeTagInput", () => {
  it("normalizes display names and stable slugs", () => {
    expect(normalizeTagInput("  Gia Đình  ")).toEqual({ name: "Gia Đình", slug: "gia-dinh" });
    expect(normalizeTagInput("QR code")).toEqual({ name: "QR code", slug: "qr-code" });
    expect(normalizeTagInput("  social   media ")).toEqual({ name: "social media", slug: "social-media" });
  });

  it("rejects unusable or oversized tags", () => {
    expect(() => normalizeTagInput("---")).toThrow(/tag/i);
    expect(() => normalizeTagInput("x".repeat(81))).toThrow(/80/);
  });
});
