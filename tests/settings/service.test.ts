import { describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/db/client";
import { migrateDatabase } from "@/lib/db/migrate";
import { getCleanerSettings, updateCleanerSettings } from "@/lib/settings/service";

describe("cleaner settings", () => {
  it("uses safe defaults and persists duplicate thresholds", () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);

    expect(getCleanerSettings(db)).toEqual({ dhashThreshold: 8, clipThreshold: 0.94 });

    updateCleanerSettings(db, { dhashThreshold: 6, clipThreshold: 0.96 });
    expect(getCleanerSettings(db)).toEqual({ dhashThreshold: 6, clipThreshold: 0.96 });

    const rows = db.prepare(`SELECT key FROM settings ORDER BY key`).all();
    expect(rows).toEqual([{ key: "clip_threshold" }, { key: "dhash_threshold" }]);
    db.close();
  });
});
