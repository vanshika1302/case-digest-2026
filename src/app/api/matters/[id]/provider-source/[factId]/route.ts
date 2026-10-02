import { NextRequest, NextResponse } from "next/server";
import { getFact, isShared, positiveId } from "@/lib/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; factId: string }> }) {
  const { id, factId } = await params;
  const matterId = positiveId(id);
  const provider = req.nextUrl.searchParams.get("providerContactId");
  const providerId = provider === null ? undefined : positiveId(provider);
  if (!matterId || (provider !== null && !providerId)) return NextResponse.json({ error: "Invalid matter or provider" }, { status: 400 });
  const fact = getFact(factId);
  if (!fact || fact.matterId !== matterId || !isShared(fact, providerId)) {
    return NextResponse.json({ error: "Fact not found" }, { status: 404 });
  }
  return NextResponse.json({ factId: fact.id, title: fact.title, detail: fact.detail, date: fact.date, source: fact.source },
    { headers: { "Cache-Control": "no-store" } });
}
