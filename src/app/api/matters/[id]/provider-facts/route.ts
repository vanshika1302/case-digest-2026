import { NextRequest, NextResponse } from "next/server";
import { getProviderDigest, positiveId } from "@/lib/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matterId = positiveId(id);
  const provider = req.nextUrl.searchParams.get("providerContactId");
  const providerId = provider === null ? undefined : positiveId(provider);
  const since = req.nextUrl.searchParams.get("since") ?? undefined;
  if (!matterId || (provider !== null && !providerId) || (since !== undefined && !Number.isFinite(Date.parse(since)))) {
    return NextResponse.json({ error: "Invalid matter, provider or since" }, { status: 400 });
  }
  const digest = getProviderDigest(matterId, providerId, since);
  if (!digest) return NextResponse.json({ error: "Matter not synced yet" }, { status: 404 });
  return NextResponse.json(digest, { headers: { "Cache-Control": "no-store" } });
}
