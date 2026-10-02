import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The record behind any fact: "click on anything and open the note, document or email it came from".
export async function GET(_req: Request, { params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params;
  const clioId = Number(id);

  if (resource === "matter") {
    const row = db.prepare("SELECT data FROM matters WHERE clio_id = ?").get(clioId) as { data: string } | undefined;
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ resource, clioId, data: JSON.parse(row.data) });
  }

  const row = db.prepare("SELECT data FROM items WHERE resource = ? AND clio_id = ?").get(resource, clioId) as { data: string } | undefined;
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const hasFile = resource === "documents" && db.prepare("SELECT 1 FROM document_files WHERE document_id = ?").get(clioId);
  return NextResponse.json({
    resource,
    clioId,
    data: JSON.parse(row.data),
    fileUrl: hasFile ? `/api/documents/${clioId}/file` : undefined,
  });
}
