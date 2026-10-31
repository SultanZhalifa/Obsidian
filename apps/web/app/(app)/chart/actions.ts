"use server";

import { revalidatePath } from "next/cache";
import { createDrawingSchema, type Timeframe } from "@obsidian/core";
import { getCurrentUser } from "@/lib/auth";
import {
  createDrawing,
  deleteDrawing,
  clearDrawings,
} from "@/lib/drawings";
import { assertSameOrigin, rateLimit } from "@/lib/security";

export interface DrawingResult {
  ok: boolean;
  error?: string;
}

export async function createDrawingAction(
  input: unknown,
): Promise<DrawingResult> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const limit = rateLimit(`draw:${user.id}`, 60, 2);
  if (!limit.allowed) return { ok: false, error: "Too many drawings, slow down." };

  const parsed = createDrawingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid drawing." };
  }
  const result = await createDrawing(user.id, parsed.data);
  if (result.ok) revalidatePath("/chart");
  return result;
}

export async function deleteDrawingAction(id: string): Promise<void> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) return;
  await deleteDrawing(user.id, id);
  revalidatePath("/chart");
}

export async function clearDrawingsAction(
  symbol: string,
  timeframe: string,
): Promise<void> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) return;
  await clearDrawings(user.id, symbol.toUpperCase(), timeframe as Timeframe);
  revalidatePath("/chart");
}
