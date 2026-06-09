import "server-only";
import { db } from "@obsidian/db";
import { auditLog } from "@obsidian/db/schema";

/**
 * Append a security-relevant event to the immutable audit log. `detail` is
 * serialized to compact JSON; never include secrets or raw passwords. Failures
 * are swallowed (logging must never break a user action) but logged to stderr.
 */
export async function audit(
  userId: string | null,
  action: string,
  detail?: Record<string, unknown>,
  ip?: string,
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId,
      action,
      detail: detail ? JSON.stringify(detail) : null,
      ip,
    });
  } catch (err) {
    console.error("[audit] failed to write audit entry", action, err);
  }
}
