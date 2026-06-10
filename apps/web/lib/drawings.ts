import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@obsidian/db";
import { drawings, type Drawing } from "@obsidian/db/schema";
import type { CreateDrawingInput, Timeframe } from "@obsidian/core";

const MAX_DRAWINGS_PER_CHART = 50;

export async function getDrawings(
  userId: string,
  symbol: string,
  timeframe: Timeframe,
): Promise<Drawing[]> {
  return db
    .select()
    .from(drawings)
    .where(
      and(
        eq(drawings.userId, userId),
        eq(drawings.symbol, symbol),
        eq(drawings.timeframe, timeframe),
      ),
    );
}

export async function createDrawing(
  userId: string,
  input: CreateDrawingInput,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await getDrawings(userId, input.symbol, input.timeframe as Timeframe);
  if (existing.length >= MAX_DRAWINGS_PER_CHART) {
    return { ok: false, error: "This chart already has the maximum number of drawings." };
  }
  await db.insert(drawings).values({
    userId,
    symbol: input.symbol,
    timeframe: input.timeframe,
    kind: input.kind,
    x1: input.x1,
    y1: input.y1,
    x2: input.x2 ?? null,
    y2: input.y2 ?? null,
  });
  return { ok: true };
}

export async function deleteDrawing(userId: string, id: string): Promise<void> {
  await db.delete(drawings).where(and(eq(drawings.id, id), eq(drawings.userId, userId)));
}

export async function clearDrawings(
  userId: string,
  symbol: string,
  timeframe: Timeframe,
): Promise<void> {
  await db
    .delete(drawings)
    .where(
      and(
        eq(drawings.userId, userId),
        eq(drawings.symbol, symbol),
        eq(drawings.timeframe, timeframe),
      ),
    );
}
