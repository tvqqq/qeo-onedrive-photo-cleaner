import { describe, expect, it } from "vitest";
import { assertSameOriginJson } from "@/lib/security/request";

describe("mutation request guard", () => {
  it("accepts same-origin JSON", () => {
    const request = new Request("http://localhost:3000/api/settings", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: "{}",
    });

    expect(() => assertSameOriginJson(request)).not.toThrow();
  });

  it("rejects cross-origin requests", () => {
    const request = new Request("http://localhost:3000/api/settings", {
      method: "POST",
      headers: { origin: "https://example.invalid", "content-type": "application/json" },
      body: "{}",
    });

    expect(() => assertSameOriginJson(request)).toThrow(/cross-origin/i);
  });
});
