import { describe, expect, it } from "vitest";
import { redact } from "@/lib/security/redact";

describe("redact", () => {
  it("removes token-shaped and credential fields recursively", () => {
    const value = {
      credential: "hidden-value",
      access: "abc.def.ghi",
      nested: { password: "nope", safe: "visible" },
    };

    const result = redact(value) as Record<string, unknown>;
    expect(JSON.stringify(result)).not.toContain("hidden-value");
    expect(JSON.stringify(result)).not.toContain("abc.def.ghi");
    expect(JSON.stringify(result)).not.toContain("nope");
    expect(JSON.stringify(result)).toContain("visible");
  });
});
