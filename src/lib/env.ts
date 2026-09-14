import { z } from "zod";

const envSchema = z.object({
  DATA_DIR: z.string().min(1).default("/data"),
  MICROSOFT_CLIENT_ID: z.string().default(""),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  DEMO_MODE: z
    .enum(["0", "1"])
    .default("0")
    .transform((value) => value === "1"),
  CLIP_MODEL_ID: z.string().min(1).default("Xenova/clip-vit-base-patch32"),
});

export function parseEnv(input: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  return envSchema.parse(input);
}

export const env = parseEnv(process.env);
