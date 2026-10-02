import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import type Anthropic from "@anthropic-ai/sdk";

/*
 * Turns a downloaded Clio document into model input. PDFs (including scans) go
 * to the model natively, so it reads scanned pages visually: no separate OCR step.
 * Long PDFs are split into chunks; each chunk knows its page offset so cited
 * page numbers always refer to the original file.
 */

export type DocChunk = {
  blocks: Anthropic.ContentBlockParam[];
  pageOffset: number;     // add to the model's chunk-relative page number
  pageRange?: [number, number];
  isImage: boolean;
};

const PAGES_PER_CHUNK = Number(process.env.PDF_PAGES_PER_CHUNK ?? 40);
const MAX_TEXT_CHARS = 150_000;
const IMAGE_TYPES: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
};
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".html", ".htm", ".eml", ".json", ".xml", ".rtf"]);

export class UnsupportedDocumentError extends Error {}

export async function documentToChunks(filePath: string, contentType?: string | null): Promise<DocChunk[]> {
  const ext = path.extname(filePath).toLowerCase();
  const type = (contentType ?? "").toLowerCase();
  const bytes = fs.readFileSync(filePath);

  if (ext === ".pdf" || type.includes("pdf")) return pdfChunks(bytes);

  const imageType = IMAGE_TYPES[ext] ?? (type.startsWith("image/") ? IMAGE_TYPES["." + type.split("/")[1]] : undefined);
  if (imageType) {
    if (bytes.length > 5 * 1024 * 1024) throw new UnsupportedDocumentError("image larger than 5 MB");
    return [{
      blocks: [{ type: "image", source: { type: "base64", media_type: imageType, data: bytes.toString("base64") } }],
      pageOffset: 0,
      isImage: true,
    }];
  }

  if (ext === ".docx" || type.includes("wordprocessingml")) {
    const { value } = await mammoth.extractRawText({ buffer: bytes });
    return [textChunk(value)];
  }

  if (TEXT_EXTENSIONS.has(ext) || type.startsWith("text/") || type.includes("rfc822")) {
    return [textChunk(bytes.toString("utf8"))];
  }

  throw new UnsupportedDocumentError(`unsupported file type ${ext || type || "unknown"}`);
}

function textChunk(text: string): DocChunk {
  return { blocks: [{ type: "text", text: text.slice(0, MAX_TEXT_CHARS) }], pageOffset: 0, isImage: false };
}

async function pdfChunks(bytes: Buffer): Promise<DocChunk[]> {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = source.getPageCount();
  const pdfBlock = (data: Uint8Array | Buffer): Anthropic.ContentBlockParam => ({
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: Buffer.from(data).toString("base64") },
  });

  if (total <= PAGES_PER_CHUNK) {
    return [{ blocks: [pdfBlock(bytes)], pageOffset: 0, pageRange: [1, total], isImage: false }];
  }

  const chunks: DocChunk[] = [];
  for (let start = 0; start < total; start += PAGES_PER_CHUNK) {
    const end = Math.min(start + PAGES_PER_CHUNK, total);
    const part = await PDFDocument.create();
    const pages = await part.copyPages(source, Array.from({ length: end - start }, (_, i) => start + i));
    pages.forEach((p) => part.addPage(p));
    chunks.push({ blocks: [pdfBlock(await part.save())], pageOffset: start, pageRange: [start + 1, end], isImage: false });
  }
  return chunks;
}
