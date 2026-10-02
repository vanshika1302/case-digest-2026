import { NextResponse } from "next/server";
import { isConnected } from "@/lib/clio";
import { listMatters } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isConnected()) return NextResponse.json({ connected: false, matters: [] });
  try {
    return NextResponse.json({ connected: true, matters: await listMatters() });
  } catch (e) {
    return NextResponse.json({ connected: true, error: (e as Error).message }, { status: 502 });
  }
}
