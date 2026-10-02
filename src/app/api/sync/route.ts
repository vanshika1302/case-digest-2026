import { NextResponse } from "next/server";
import { NotConnectedError } from "@/lib/clio";
import { syncMatter } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { matterId, full } = (await req.json()) as { matterId?: number; full?: boolean };
  if (!matterId) return NextResponse.json({ error: "matterId is required" }, { status: 400 });
  try {
    return NextResponse.json(await syncMatter(Number(matterId), { full: Boolean(full) }));
  } catch (e) {
    const status = e instanceof NotConnectedError ? 401 : 502;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
