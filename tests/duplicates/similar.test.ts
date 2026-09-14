import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { computeDHash, hammingDistance64, splitDHashBands } from "@/lib/duplicates/similar";

async function gradient(path: string, reverse = false, quality = 90) {
  const width = 90;
  const height = 80;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = reverse ? 255 - Math.round((x / (width - 1)) * 255) : Math.round((x / (width - 1)) * 255);
      const offset = (y * width + x) * 3;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
    }
  }
  await sharp(data, { raw: { width, height, channels: 3 } }).jpeg({ quality }).toFile(path);
}

describe("similar photo hashing", () => {
  it("keeps recompressed variants within a small dHash radius", async () => {
    const dir = mkdtempSync(join(tmpdir(), "qeo-dhash-"));
    const a = join(dir, "a.jpg");
    const b = join(dir, "b.jpg");
    await gradient(a, false, 95);
    await gradient(b, false, 55);
    expect(hammingDistance64(await computeDHash(a), await computeDHash(b))).toBeLessThanOrEqual(8);
  });

  it("separates opposite visual gradients", async () => {
    const dir = mkdtempSync(join(tmpdir(), "qeo-dhash-"));
    const a = join(dir, "a.jpg");
    const b = join(dir, "b.jpg");
    await gradient(a, false);
    await gradient(b, true);
    expect(hammingDistance64(await computeDHash(a), await computeDHash(b))).toBeGreaterThan(8);
  });

  it("splits a 64-bit hash into four stable 16-bit bands", () => {
    expect(splitDHashBands(0x123456789abcdef0n)).toEqual([0x1234, 0x5678, 0x9abc, 0xdef0]);
  });
});
