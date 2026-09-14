import type { AppDatabase } from "@/lib/db/client";

export interface CleanerSettings {
  dhashThreshold: number;
  clipThreshold: number;
}

const DEFAULT_SETTINGS: CleanerSettings = {
  dhashThreshold: 8,
  clipThreshold: 0.94,
};

function readNumber(db: AppDatabase, key: string, fallback: number): number {
  const row = db.prepare(`SELECT value_json FROM settings WHERE key = ?`).get(key) as
    | { value_json: string }
    | undefined;
  if (!row) return fallback;
  try {
    const value = JSON.parse(row.value_json) as unknown;
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function getCleanerSettings(db: AppDatabase): CleanerSettings {
  return {
    dhashThreshold: readNumber(db, "dhash_threshold", DEFAULT_SETTINGS.dhashThreshold),
    clipThreshold: readNumber(db, "clip_threshold", DEFAULT_SETTINGS.clipThreshold),
  };
}

export function updateCleanerSettings(db: AppDatabase, settings: CleanerSettings): void {
  if (!Number.isInteger(settings.dhashThreshold) || settings.dhashThreshold < 0 || settings.dhashThreshold > 64) {
    throw new Error("dHash threshold must be an integer from 0 to 64");
  }
  if (!Number.isFinite(settings.clipThreshold) || settings.clipThreshold <= 0 || settings.clipThreshold > 1) {
    throw new Error("CLIP threshold must be greater than 0 and at most 1");
  }

  const now = Date.now();
  const upsert = db.prepare(`
    INSERT INTO settings(key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `);
  upsert.run("dhash_threshold", JSON.stringify(settings.dhashThreshold), now);
  upsert.run("clip_threshold", JSON.stringify(settings.clipThreshold), now);
}
