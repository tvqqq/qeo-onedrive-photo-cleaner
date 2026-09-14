import { join } from "node:path";
import { env } from "@/lib/env";

export interface ZeroShotResult {
  label: string;
  score: number;
}

export type ZeroShotFn = (
  path: string,
  candidateLabels: string[],
) => Promise<ZeroShotResult[]>;
export type ZeroShotFactory = () => Promise<ZeroShotFn>;

async function createDefaultClassifier(): Promise<ZeroShotFn> {
  const transformers = await import("@huggingface/transformers");
  transformers.env.cacheDir = join(env.DATA_DIR, "models");
  const classifier = await transformers.pipeline(
    "zero-shot-image-classification",
    env.CLIP_MODEL_ID,
  ) as unknown as (
    input: unknown,
    candidateLabels: string[],
  ) => Promise<ZeroShotResult[]>;

  return async (path, candidateLabels) => {
    const image = await transformers.RawImage.read(path);
    return classifier(image, candidateLabels);
  };
}

export class ZeroShotClassifier {
  private classifierPromise: Promise<ZeroShotFn> | null = null;

  constructor(private readonly factory: ZeroShotFactory = createDefaultClassifier) {}

  async classify(path: string, candidateLabels: string[]): Promise<ZeroShotResult[]> {
    this.classifierPromise ??= this.factory();
    const classifier = await this.classifierPromise;
    return classifier(path, candidateLabels);
  }
}
