import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("defaults to local-only safe values", () => {
    const value = parseEnv({});

    expect(value.DATA_DIR).toBe("/data");
    expect(value.APP_BASE_URL).toBe("http://localhost:3000");
    expect(value.DEMO_MODE).toBe(false);
    expect(value.CLIP_MODEL_ID).toBe("Xenova/clip-vit-base-patch32");
  });
});
