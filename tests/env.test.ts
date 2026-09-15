import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("defaults to local-only safe values", () => {
    const value = parseEnv({});

    expect(value.DATA_DIR).toBe("/data");
    expect(value.APP_BASE_URL).toBe("http://localhost:3000");
    expect(value.DEMO_MODE).toBe(false);
    expect(value.CLIP_MODEL_ID).toBe("Xenova/clip-vit-base-patch32");
    expect(value.WORKER_LANE).toBe("core");
  });

  it("accepts the ML worker lane", () => {
    expect(parseEnv({ WORKER_LANE: "ml" }).WORKER_LANE).toBe("ml");
  });

  it("rejects unknown worker lanes", () => {
    expect(() => parseEnv({ WORKER_LANE: "other" })).toThrow();
  });
});
