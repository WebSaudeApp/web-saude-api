const SENSITIVE_KEY = /password|token|secret|authorization|cookie|code|hash/i;

export function redactLogValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) {
    return '[redacted]';
  }
  return value;
}

export function redactLogRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    safe[key] = redactLogValue(key, value);
  }
  return safe;
}
