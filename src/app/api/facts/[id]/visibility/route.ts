import { NextRequest, NextResponse } from "next/server";
import { clearVisibility, getFact, isShared, positiveId, setVisibility } from "@/lib/sharing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const input = body as Record<string, unknown>;
  const providerId = input.providerContactId === undefined ? undefined : positiveId(input.providerContactId);
  if (typeof input.shared !== "boolean" || (input.providerContactId !== undefined && !providerId)) {
    return NextResponse.json({ error: "Expected shared boolean and optional positive providerContactId" }, { status: 400 });
  }
  const fact = getFact(id);
  if (!fact) return NextResponse.json({ error: "Fact not found" }, { status: 404 });
  if (input.shared && (fact.kind === "case_value" || fact.kind === "expense")) {
    return NextResponse.json({ error: "This fact kind is firm-only" }, { status: 403 });
  }
  setVisibility(id, input.shared, providerId);
  return NextResponse.json({ factId: id, providerContactId: providerId ?? null, shared: isShared(fact, providerId) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = req.nextUrl.searchParams.get("providerContactId");
  const providerId = provider === null ? undefined : positiveId(provider);
  if (provider !== null && !providerId) return NextResponse.json({ error: "Invalid providerContactId" }, { status: 400 });
  const fact = getFact(id);
  if (!fact) return NextResponse.json({ error: "Fact not found" }, { status: 404 });
  clearVisibility(id, providerId);
  return NextResponse.json({ factId: id, providerContactId: providerId ?? null, shared: isShared(fact, providerId) });
}
