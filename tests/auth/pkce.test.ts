import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPkcePair } from "@/lib/auth/pkce";

function base64url(value: Buffer) {
  return value.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

describe("PKCE", () => {
  it("creates an S256 verifier and matching challenge", () => {
    const pair = createPkcePair();
    const expected = base64url(createHash("sha256").update(pair.verifier).digest());

    expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.verifier.length).toBeLessThanOrEqual(128);
    expect(pair.challenge).toBe(expected);
  });
});
