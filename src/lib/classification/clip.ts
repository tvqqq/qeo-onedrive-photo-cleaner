import { join } from "node:path";
import { env } from "@/lib/env";

export function normalizeEmbedding(value: Float32Array): Float32Array {
  let sumSquares = 0;
  for (const component of value) sumSquares += component * component;
  const magnitude = Math.sqrt(sumSquares);
  if (magnitude === 0) return new Float32Array(value);

  const normalized = new Float32Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    normalized[index] = value[index] / magnitude;
  }
  return normalized;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error("Embedding dimensions must match");
  const left = normalizeEmbedding(a);
  const right = normalizeEmbedding(b);
  let score = 0;
  for (let index = 0; index < left.length; index += 1) score += left[index] * right[index];
  return score;
}

export interface ClipExtractorOutput {
  data: Float32Array | number[];
}

export type ClipExtractor = (path: string) => Promise<ClipExtractorOutput>;
export type ClipFactory = () => Promise<ClipExtractor>;

async function createDefaultExtractor(): Promise<ClipExtractor> {
  const transformers = await import("@huggingface/transformers");
  transformers.env.cacheDir = join(env.DATA_DIR, "models");
  const extractor = await transformers.pipeline(
    "image-feature-extraction",
    env.CLIP_MODEL_ID,
  ) as unknown as (input: unknown) => Promise<{ data: Float32Array }>;

  return async (path: string) => {
    const image = await transformers.RawImage.read(path);
    const output = await extractor(image);
    return { data: output.data };
  };
}

export class ClipService {
  private extractorPromise: Promise<ClipExtractor> | null = null;

  constructor(private readonly factory: ClipFactory = createDefaultExtractor) {}

  async embedImage(path: string): Promise<Float32Array> {
    this.extractorPromise ??= this.factory();
    const extractor = await this.extractorPromise;
    const output = await extractor(path);
    return normalizeEmbedding(Float32Array.from(output.data));
  }
}
