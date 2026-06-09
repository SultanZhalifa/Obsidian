"use server";

import { revalidatePath } from "next/cache";
import { placeOrderSchema } from "@obsidian/core";
import { getCurrentUser } from "@/lib/auth";
import { executeOrder } from "@/lib/trading";
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
