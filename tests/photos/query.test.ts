import { describe, expect, it } from "vitest";
import { normalizePhotoQuery } from "@/lib/photos/query";

describe("normalizePhotoQuery", () => {
  it("falls back safely for invalid query parameters", () => {
    expect(normalizePhotoQuery({ page: "-5", sort: "DROP TABLE photos", category: "not-real" })).toMatchObject({
      page: 1,
      pageSize: 60,
      sort: "taken-desc",
      category: undefined,
    });
  });

  it("normalizes supported search, filter, date, and sort values", () => {
    const query = normalizePhotoQuery({
      page: "2",
      q: "  iPhone  ",
      mime: "image/jpeg",
      category: "travel",
      from: "2026-01-01",
      to: "2026-01-31",
      sort: "size-desc",
    });

    expect(query).toMatchObject({
      page: 2,
      pageSize: 60,
      search: "iPhone",
      mimeType: "image/jpeg",
      category: "travel",
      sort: "size-desc",
    });
    expect(query.takenFrom).toBe(Date.parse("2026-01-01T00:00:00.000Z"));
    expect(query.takenTo).toBe(Date.parse("2026-01-31T23:59:59.999Z"));
  });
});
