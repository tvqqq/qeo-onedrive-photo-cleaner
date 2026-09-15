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

  private getClassifier(): Promise<ZeroShotFn> {
    this.classifierPromise ??= this.factory();
    return this.classifierPromise;
  }

  async initialize(): Promise<void> {
    await this.getClassifier();
  }

  async classify(path: string, candidateLabels: string[]): Promise<ZeroShotResult[]> {
    const classifier = await this.getClassifier();
    return classifier(path, candidateLabels);
  }
}
