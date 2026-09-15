import { z } from "zod";

const schema = z.object({
  DATA_DIR: z.string().min(1).default("/data"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  DEMO_MODE: z.enum(["0", "1"]).default("0").transform((value) => value === "1"),
  CLIP_MODEL_ID: z.string().min(1).default("Xenova/clip-vit-base-patch32"),
  MICROSOFT_APP_ID: z.string().default(""),
  WORKER_LANE: z.enum(["core", "ml"]).default("core"),
});

export type AppEnv = z.infer<typeof schema>;
export function parseEnv(input: NodeJS.ProcessEnv | Record<string, string | undefined>): AppEnv {
  return schema.parse(input);
}
export const env = parseEnv(process.env);
