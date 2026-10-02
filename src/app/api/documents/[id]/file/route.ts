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
  if (!resolved.startsWith(path.resolve(DATA_DIR) + path.sep) || !fs.existsSync(resolved)) {
    return NextResponse.json({ error: "file missing" }, { status: 404 });
  }
  // Only types that cannot run script are shown inline. Anything else (html, svg, ...) downloads, so a synced
  // file can never execute on this origin.
  const type = (row.content_type ?? "").split(";")[0].trim().toLowerCase();
  const inlineSafe = type === "application/pdf" || ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(type);
  const name = path.basename(resolved).replace(/"/g, "");
  return new NextResponse(fs.readFileSync(resolved), {
    headers: {
      "Content-Type": inlineSafe ? type : "application/octet-stream",
      "Content-Disposition": `${inlineSafe ? "inline" : "attachment"}; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
