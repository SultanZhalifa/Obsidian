"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@obsidian/db";
import { users } from "@obsidian/db/schema";
import { registerSchema, loginSchema } from "@obsidian/core";
import {
  hashPassword,
  verifyPassword,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionToken,
  invalidateSession,
  ensureAccount,
} from "@/lib/auth";
import {
  assertSameOrigin,
  clientIp,
  userAgent,
  rateLimit,
} from "@/lib/security";
import { audit } from "@/lib/audit";

export interface AuthFormState {
  error?: string;
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await assertSameOrigin();
  const ip = (await clientIp()) ?? "unknown";

  const limit = rateLimit(`register:${ip}`, 5, 0.05); // ~3/min sustained, burst 5
  if (!limit.allowed) {
    return { error: "Too many attempts. Please wait a moment and try again." };
  }

  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const { email, password, displayName } = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    return { error: "An account with that email already exists." };
  }

  // First registered user becomes admin; everyone after is a trader.
  const countRows = await db.select({ count: countUsers() }).from(users);
  const role = Number(countRows[0]?.count ?? 0) === 0 ? "admin" : "trader";

  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(users)
    .values({ email, displayName, passwordHash, role })
    .returning({ id: users.id });
  const userId = inserted[0]!.id;

  await ensureAccount(userId);
  await audit(userId, "user.register", { email, role }, ip);

  const token = await createSession(userId, { ip, userAgent: await userAgent() });
  await setSessionCookie(token);
  redirect("/dashboard");
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  await assertSameOrigin();
  const ip = (await clientIp()) ?? "unknown";

  const limit = rateLimit(`login:${ip}`, 10, 0.1); // burst 10, ~6/min sustained
  if (!limit.allowed) {
    return { error: "Too many attempts. Please wait a moment and try again." };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Invalid email or password." };
  }
  const { email, password } = parsed.data;

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = rows[0];

  // Always run a verification to keep timing uniform whether or not the user
  // exists (mitigates user-enumeration via response time). For the missing-user
  // case we verify against a real, lazily-generated decoy hash.
  const ok = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword(await decoyHash(), password);

  if (!user || !ok) {
    await audit(user?.id ?? null, "user.login_failed", { email }, ip);
    return { error: "Invalid email or password." };
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  await ensureAccount(user.id);
  await audit(user.id, "user.login", { email }, ip);

  const token = await createSession(user.id, { ip, userAgent: await userAgent() });
  await setSessionCookie(token);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const token = await getSessionToken();
  if (token) await invalidateSession(token);
  await clearSessionCookie();
  redirect("/login");
}

// A real Argon2id hash of a random secret, generated once per process and used
// only to equalize login timing for non-existent users. It never matches any
// real password (the input is unknown random bytes).
let _decoyHash: Promise<string> | null = null;
function decoyHash(): Promise<string> {
  if (!_decoyHash) {
    const random = crypto.randomUUID() + crypto.randomUUID();
    _decoyHash = hashPassword(random);
  }
  return _decoyHash;
}

// Drizzle count helper (avoids importing sql at call site repeatedly).
import { sql as drizzleSql } from "drizzle-orm";
function countUsers() {
  return drizzleSql<number>`count(*)`;
}
