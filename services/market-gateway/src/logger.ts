import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "market-gateway" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Normalize an unknown throwable into a useful log field. The postgres driver
 * sometimes throws errors with an empty `message` but a meaningful `code`
 * (e.g. connection failures), so we surface name + code + message + cause.
 */
export function errInfo(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const e = err as Error & { code?: string; cause?: unknown };
    return {
      name: e.name,
      message: e.message || "(empty)",
      code: e.code,
      cause: e.cause instanceof Error ? e.cause.message : e.cause,
    };
  }
  return { message: String(err) };
}
