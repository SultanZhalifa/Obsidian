import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import { hash, verify } from "@node-rs/argon2";
import { db } from "@obsidian/db";
import { users, sessions, accounts, type User } from "@obsidian/db/schema";

const SESSION_COOKIE = "obsidian_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // renew when < 15 days left

/** Argon2id parameters — OWASP-recommended baseline. */
const ARGON_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON_OPTS);
}

export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password, ARGON_OPTS);
  } catch {
    return false;
  }
}

/** Generate a high-entropy session token (returned once, to the client). */
function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

/** The token is never stored directly; we store its SHA-256 as the session id. */
function sessionIdFromToken(token: string): string {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export interface SessionContext {
  ip?: string;
  userAgent?: string;
}

export async function createSession(
  userId: string,
  ctx: SessionContext = {},
): Promise<string> {
  const token = generateSessionToken();
  const id = sessionIdFromToken(token);
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return token;
}

export interface AuthedUser {
  id: string;
  email: string;
  displayName: string | null;
  role: User["role"];
}

/** Validate a raw session token; renews sliding expiry; deletes if expired. */
export async function validateSessionToken(
  token: string,
): Promise<AuthedUser | null> {
  const id = sessionIdFromToken(token);
  const rows = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (Date.now() >= row.session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  // Sliding renewal.
  if (row.session.expiresAt.getTime() - Date.now() < RENEW_THRESHOLD_MS) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
      .where(eq(sessions.id, id));
  }

  return {
    id: row.user.id,
    email: row.user.email,
    displayName: row.user.displayName,
    role: row.user.role,
  };
}

export async function invalidateSession(token: string): Promise<void> {
  const id = sessionIdFromToken(token);
  await db.delete(sessions).where(eq(sessions.id, id));
}

// --- Cookie helpers --------------------------------------------------------

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Read & validate the current request's session. Returns null if signed out. */
export async function getCurrentUser(): Promise<AuthedUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

/** Ensure a virtual paper-trading account exists for a user; return its id. */
export async function ensureAccount(userId: string): Promise<string> {
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db
    .insert(accounts)
    .values({ userId })
    .returning({ id: accounts.id });
  return inserted[0]!.id;
}
