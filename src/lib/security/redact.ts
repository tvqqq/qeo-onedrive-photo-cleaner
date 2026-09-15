const SENSITIVE_KEY = /(authorization|cookie|credential|password|secret|token)/i;
const TOKEN_SHAPED = /^[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}$/;
const TOKEN_SHAPED_IN_TEXT = /[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}/g;
const REDACTED = "[REDACTED]";

export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    if (TOKEN_SHAPED.test(value)) return REDACTED;
    return value.replace(TOKEN_SHAPED_IN_TEXT, REDACTED);
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SENSITIVE_KEY.test(key) ? REDACTED : redact(nested),
      ]),
    );
  }
  return value;
}

export function redactError(error: unknown): string {
  if (error instanceof Error) return String(redact(error.message));
  return JSON.stringify(redact(error));
}
