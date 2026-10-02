import { NextResponse } from "next/server";
import { extractMatter } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { force } = (await req.json().catch(() => ({}))) as { force?: boolean };
  try {
    return NextResponse.json(await extractMatter(Number(id), { force: Boolean(force) }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
