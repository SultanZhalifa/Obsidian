"use server";

import { revalidatePath } from "next/cache";
import { placeOrderSchema, symbolSchema } from "@obsidian/core";
import { getCurrentUser } from "@/lib/auth";
import { executeOrder, closePosition, resetAccount } from "@/lib/trading";
import { assertSameOrigin, clientIp, rateLimit } from "@/lib/security";
import { audit } from "@/lib/audit";

export interface OrderActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export async function placeOrderAction(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  await assertSameOrigin();

  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to trade." };

  const ip = (await clientIp()) ?? "unknown";
  const limit = rateLimit(`order:${user.id}`, 20, 1); // 1/s sustained, burst 20
  if (!limit.allowed) {
    return { error: "You're placing orders too quickly. Slow down a moment." };
  }

  const parsed = placeOrderSchema.safeParse({
    symbol: formData.get("symbol"),
    side: formData.get("side"),
    quantity: Number(formData.get("quantity")),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid order." };
  }
  const { symbol, side, quantity } = parsed.data;

  const result = await executeOrder(user.id, symbol, side, quantity);
  if (!result.ok) return { error: result.error };

  await audit(user.id, "order.placed", { symbol, side, quantity, fillPrice: result.fillPrice }, ip);
  revalidatePath("/trade");

  return {
    ok: true,
    message: `${side === "buy" ? "Bought" : "Sold"} ${quantity} ${symbol.replace("USDT", "")} at ${result.fillPrice}.`,
  };
}

/** Close a single open position at the live price (one-click flatten). */
export async function closePositionAction(formData: FormData): Promise<void> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) return;

  const ip = (await clientIp()) ?? "unknown";
  const limit = rateLimit(`order:${user.id}`, 20, 1);
  if (!limit.allowed) return;

  const parsed = symbolSchema.safeParse(formData.get("symbol"));
  if (!parsed.success) return;

  const result = await closePosition(user.id, parsed.data);
  if (result.ok) {
    await audit(user.id, "position.closed", { symbol: parsed.data, fillPrice: result.fillPrice }, ip);
  }
  revalidatePath("/trade");
}

/** Reset the paper-trading account back to its starting cash (destructive). */
export async function resetAccountAction(): Promise<void> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) return;

  const ip = (await clientIp()) ?? "unknown";
  const limit = rateLimit(`reset:${user.id}`, 3, 0.05);
  if (!limit.allowed) return;

  const startingCash = await resetAccount(user.id);
  await audit(user.id, "account.reset", { startingCash }, ip);
  revalidatePath("/trade");
}
