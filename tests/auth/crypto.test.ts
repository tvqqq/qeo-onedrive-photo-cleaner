import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "@/lib/auth/crypto";

describe("encrypted local state", () => {
  it("round-trips JSON without exposing plaintext", () => {
    const key = randomBytes(32);
    const input = { credential: "sensitive-value", account: "personal" };

    const cipher = encryptJson(input, key);

    expect(cipher).not.toContain("sensitive-value");
    expect(decryptJson(cipher, key)).toEqual(input);
  });
});
