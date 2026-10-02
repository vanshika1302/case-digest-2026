import { NextRequest, NextResponse } from "next/server";
import { getDigest } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/matters/:id/facts            -> full digest
// GET /api/matters/:id/facts?since=ISO  -> only facts first seen after that time
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const digest = getDigest(Number(id), req.nextUrl.searchParams.get("since") ?? undefined);
  if (!digest) return NextResponse.json({ error: "Matter not synced yet" }, { status: 404 });
  return NextResponse.json(digest);
}
