import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { db, DATA_DIR } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves a synced document inline. For PDFs, link to `${url}#page=N` to jump to the cited page.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = db.prepare("SELECT path, content_type FROM document_files WHERE document_id = ?").get(Number(id)) as
    { path: string; content_type: string | null } | undefined;
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const resolved = path.resolve(row.path);
  if (!resolved.startsWith(path.resolve(DATA_DIR)) || !fs.existsSync(resolved)) {
    return NextResponse.json({ error: "file missing" }, { status: 404 });
  }
  return new NextResponse(fs.readFileSync(resolved), {
    headers: {
      "Content-Type": row.content_type ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${path.basename(resolved).replace(/"/g, "")}"`,
    },
  });
}
