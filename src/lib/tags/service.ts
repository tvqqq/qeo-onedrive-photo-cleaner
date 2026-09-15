import type { AppDatabase } from "@/lib/db/client";
import { markDriveItemDeleted } from "@/lib/db/repositories";
import { env } from "@/lib/env";
import { GraphRequestError } from "@/lib/graph/client";
import { updateJobProgress } from "@/lib/jobs/repository";
import { redactError } from "@/lib/security/redact";
import {
  ensureAiVocabulary,
  listPhotosNeedingTags,
  replaceAiTagsForPhoto,
} from "@/lib/tags/repository";
import type { AiTagSuggestion } from "@/lib/tags/types";
import {
  TAG_MAX_AI_TAGS,
  TAG_MIN_SCORE,
  TAG_TAXONOMY_VERSION,
  TAG_VOCABULARY,
} from "@/lib/tags/vocabulary";
import { getThumbnailPath, type ThumbnailDriveApi } from "@/lib/thumbnails/cache";

export interface ModelScore {
  label: string;
  score: number;
}

export interface TagPhotosJobContext {
  db: AppDatabase;
  drive: ThumbnailDriveApi;
  classifier: {
    initialize(): Promise<void>;
    classify(path: string, candidateLabels: string[]): Promise<ModelScore[]>;
  };
  dataDir?: string;
  warn?: (message: string) => void;
}

const TAG_BY_PROMPT = new Map(TAG_VOCABULARY.map((tag) => [tag.prompt, tag]));

export function selectAiTagSuggestions(scores: ModelScore[]): AiTagSuggestion[] {
  return scores
    .map((score) => ({ score, tag: TAG_BY_PROMPT.get(score.label) }))
    .filter((entry): entry is { score: ModelScore; tag: (typeof TAG_VOCABULARY)[number] } =>
      Boolean(entry.tag) && entry.score.score >= TAG_MIN_SCORE,
    )
    .sort((a, b) => b.score.score - a.score.score)
    .slice(0, TAG_MAX_AI_TAGS)
    .map(({ score, tag }) => ({ slug: tag.slug, confidence: score.score }));
}

function isRemoteMissing(error: unknown): error is GraphRequestError {
  return error instanceof GraphRequestError &&
    error.status === 404 &&
    (error.code === null || error.code.toLowerCase() === "itemnotfound");
}

export async function runTagPhotosJob(
  context: TagPhotosJobContext,
  jobId: string,
): Promise<void> {
  ensureAiVocabulary(context.db);
  await context.classifier.initialize();

  const photos = listPhotosNeedingTags(
    context.db,
    env.CLIP_MODEL_ID,
    TAG_TAXONOMY_VERSION,
  );
  const candidateLabels = TAG_VOCABULARY.map((tag) => tag.prompt);
  const warn = context.warn ?? console.warn;
  let processed = 0;

  for (const photo of photos) {
    let thumbnailPath: string;
    try {
      thumbnailPath = await getThumbnailPath(
        { driveItemId: photo.driveItemId, etag: photo.etag },
        context.drive,
        context.dataDir ?? env.DATA_DIR,
      );
    } catch (error) {
      if (isRemoteMissing(error)) {
        markDriveItemDeleted(context.db, photo.driveItemId);
        processed += 1;
        updateJobProgress(context.db, jobId, processed, photos.length);
        continue;
      }
      throw error;
    }

    let scores: ModelScore[];
    try {
      scores = await context.classifier.classify(thumbnailPath, candidateLabels);
    } catch (error) {
      if (error instanceof GraphRequestError) throw error;
      warn(redactError(error));
      processed += 1;
      updateJobProgress(context.db, jobId, processed, photos.length);
      continue;
    }

    replaceAiTagsForPhoto(
      context.db,
      photo.id,
      selectAiTagSuggestions(scores),
      {
        taggedEtag: photo.etag,
        modelId: env.CLIP_MODEL_ID,
        taxonomyVersion: TAG_TAXONOMY_VERSION,
        taggedAt: Date.now(),
      },
    );
    processed += 1;
    updateJobProgress(context.db, jobId, processed, photos.length);
  }
}
