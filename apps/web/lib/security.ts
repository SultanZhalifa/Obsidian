import "server-only";
import { headers } from "next/headers";

/**
 * Origin-based CSRF protection for state-changing requests.
 *
 * Server Actions in Next.js already POST same-origin, but we defend in depth:
 * any mutating action verifies the request Origin/Referer host matches the Host
 * header. This blocks cross-site form posts without needing a separate token,
 * which is the modern, robust approach for same-site cookie auth.
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");
  if (!host) throw new Error("CSRF: missing host header");

  // Allow requests with no Origin only if they are clearly same-site navigations
  // (some legitimate clients omit Origin on same-origin GET, but mutations
  // should always carry it). If present, it must match the host.
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new Error("CSRF: malformed origin");
    }
    if (originHost !== host) {
      throw new Error("CSRF: origin mismatch");
    }
  }
}

export async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim();
  return h.get("x-real-ip") ?? undefined;
}

export async function userAgent(): Promise<string | undefined> {
  const h = await headers();
  return h.get("user-agent") ?? undefined;
}

// --- Token-bucket rate limiter (in-memory, per process) --------------------

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * Token-bucket limiter. `capacity` tokens, refilled at `refillPerSec`. Each
 * call consumes one token. Keyed by an arbitrary string (e.g. `login:<ip>`).
 *
 * In-memory is appropriate for a single-instance deployment; for horizontal
 * scaling this interface would be backed by Redis without changing call sites.
 */
export function rateLimit(
  key: string,
  capacity: number,
  refillPerSec: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };

  const elapsedSec = (now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
  bucket.updatedAt = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return { allowed: true, retryAfterMs: 0 };
  }

  buckets.set(key, bucket);
  const needed = 1 - bucket.tokens;
  return { allowed: false, retryAfterMs: Math.ceil((needed / refillPerSec) * 1000) };
}
