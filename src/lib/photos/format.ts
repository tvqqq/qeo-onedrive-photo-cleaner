function finitePositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
}

export function formatDimensions(width: number | null, height: number | null): string | null {
  if (!finitePositive(width) || !finitePositive(height)) return null;
  return `${Math.round(width)} × ${Math.round(height)}`;
}

export function formatCamera(make: string | null, model: string | null): string | null {
  const normalizedMake = make?.trim() || null;
  const normalizedModel = model?.trim() || null;
  if (!normalizedMake && !normalizedModel) return null;
  if (!normalizedMake) return normalizedModel;
  if (!normalizedModel) return normalizedMake;
  if (normalizedModel.toLowerCase().startsWith(normalizedMake.toLowerCase())) return normalizedModel;
  return `${normalizedMake} ${normalizedModel}`;
}

export function formatAperture(fNumber: number | null): string | null {
  if (!finitePositive(fNumber)) return null;
  return `f/${Number(fNumber.toFixed(2))}`;
}

export function formatExposure(
  numerator: number | null,
  denominator: number | null,
): string | null {
  if (!finitePositive(numerator) || !finitePositive(denominator)) return null;
  const seconds = numerator / denominator;
  if (seconds >= 1) return `${Number(seconds.toFixed(3))}s`;
  return `${numerator}/${denominator}s`;
}

export function formatFocalLength(focalLength: number | null): string | null {
  if (!finitePositive(focalLength)) return null;
  return `${Number(focalLength.toFixed(2))} mm`;
}

export function formatDateTime(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
