import { NextResponse } from "next/server";
import { sql } from "@obsidian/db";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe. Reports DB reachability and the market gateway's
 * own health (proxied). Returns 200 only when the database is reachable; the
 * gateway being down is surfaced but does not fail the web app's own health.
 */
export async function GET() {
  const result: Record<string, unknown> = { service: "web", at: new Date().toISOString() };

  let dbOk = false;
  try {
    await sql`select 1`;
    dbOk = true;
  } catch (err) {
    result.dbError = (err as Error).message;
  }
  result.db = dbOk;

  try {
    const res = await fetch(`${serverEnv.gatewayHttpUrl}/health`, {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    result.gateway = res.ok ? await res.json() : { status: "unreachable" };
  } catch {
    result.gateway = { status: "unreachable" };
  }

  return NextResponse.json(result, { status: dbOk ? 200 : 503 });
}
