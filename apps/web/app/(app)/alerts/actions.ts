"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@obsidian/db";
import { alerts } from "@obsidian/db/schema";
import { createAlertSchema } from "@obsidian/core";
import { getCurrentUser } from "@/lib/auth";
import { assertSameOrigin, clientIp, rateLimit } from "@/lib/security";
import { audit } from "@/lib/audit";

export interface AlertActionState {
  ok?: boolean;
  error?: string;
}

export async function createAlertAction(
  _prev: AlertActionState,
  formData: FormData,
): Promise<AlertActionState> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const ip = (await clientIp()) ?? "unknown";
  const limit = rateLimit(`alert:${user.id}`, 30, 0.5);
  if (!limit.allowed) return { error: "Too many alert changes. Slow down a moment." };

  const timeframe = formData.get("timeframe");
  const parsed = createAlertSchema.safeParse({
    symbol: formData.get("symbol"),
    kind: formData.get("kind"),
    threshold: Number(formData.get("threshold")),
    timeframe: timeframe ? String(timeframe) : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid alert." };
  }
  const { symbol, kind, threshold } = parsed.data;

  await db.insert(alerts).values({
    userId: user.id,
    symbol,
    kind,
    threshold,
    timeframe: parsed.data.timeframe ?? null,
    status: "active",
  });
  await audit(user.id, "alert.created", { symbol, kind, threshold }, ip);
  revalidatePath("/alerts");
  return { ok: true };
}

export async function deleteAlertAction(formData: FormData): Promise<void> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id"));
  await db.delete(alerts).where(and(eq(alerts.id, id), eq(alerts.userId, user.id)));
  await audit(user.id, "alert.deleted", { id });
  revalidatePath("/alerts");
}

export async function reactivateAlertAction(formData: FormData): Promise<void> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id"));
  await db
    .update(alerts)
    .set({ status: "active", triggeredAt: null, triggeredValue: null })
    .where(and(eq(alerts.id, id), eq(alerts.userId, user.id)));
  revalidatePath("/alerts");
}
