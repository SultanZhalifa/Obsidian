"use server";

import { revalidatePath } from "next/cache";
import { symbolSchema } from "@obsidian/core";
import { getCurrentUser } from "@/lib/auth";
import { addToWatchlist, removeFromWatchlist } from "@/lib/watchlist";
import { getTradableSymbols, searchSymbols, type SymbolInfo } from "@/lib/market";
import { assertSameOrigin, clientIp, rateLimit } from "@/lib/security";
import { audit } from "@/lib/audit";

export interface WatchlistActionState {
  ok?: boolean;
  error?: string;
}

export async function addSymbolAction(
  _prev: WatchlistActionState,
  formData: FormData,
): Promise<WatchlistActionState> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const limit = rateLimit(`watchlist:${user.id}`, 30, 0.5);
  if (!limit.allowed) return { error: "Too many changes. Slow down a moment." };

  const parsed = symbolSchema.safeParse(formData.get("symbol"));
  if (!parsed.success) return { error: "Invalid symbol." };
  const symbol = parsed.data;

  // Only allow symbols Binance actually trades (prevents dead subscriptions).
  const tradable = await getTradableSymbols();
  if (!tradable.some((s) => s.symbol === symbol)) {
    return { error: "That market isn't available." };
  }

  const result = await addToWatchlist(user.id, symbol);
  if (!result.ok) return { error: result.error };

  await audit(user.id, "watchlist.add", { symbol }, (await clientIp()) ?? undefined);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeSymbolAction(formData: FormData): Promise<void> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) return;
  const parsed = symbolSchema.safeParse(formData.get("symbol"));
  if (!parsed.success) return;
  await removeFromWatchlist(user.id, parsed.data);
  await audit(user.id, "watchlist.remove", { symbol: parsed.data });
  revalidatePath("/dashboard");
}

/** Server-side symbol search for the add-symbol modal. */
export async function searchSymbolsAction(query: string): Promise<SymbolInfo[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return searchSymbols(query, 30);
}
