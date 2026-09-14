import sharp from "sharp";

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
const HASH_MASK = (1n << 64n) - 1n;

export async function computeDHash(path: string): Promise<bigint> {
  const { data } = await sharp(path)
    .greyscale()
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = 0n;
  for (let y = 0; y < HASH_HEIGHT; y += 1) {
    for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
      hash <<= 1n;
      const offset = y * HASH_WIDTH + x;
      if (data[offset] > data[offset + 1]) hash |= 1n;
    }
  }
  return hash & HASH_MASK;
}

export function hammingDistance64(a: bigint, b: bigint): number {
  let value = (a ^ b) & HASH_MASK;
  let distance = 0;
  while (value !== 0n) {
    value &= value - 1n;
    distance += 1;
  }
  return distance;
}

export function splitDHashBands(hash: bigint): [number, number, number, number] {
  const value = hash & HASH_MASK;
  return [
    Number((value >> 48n) & 0xffffn),
    Number((value >> 32n) & 0xffffn),
    Number((value >> 16n) & 0xffffn),
    Number(value & 0xffffn),
  ];
}
