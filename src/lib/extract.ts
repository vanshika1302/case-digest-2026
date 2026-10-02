import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { documentToChunks, UnsupportedDocumentError } from "./documents";
import { FACT_KINDS, type Fact, type FactKind } from "./types";

/*
 * Digest once, cite everything.
 * - Each Clio record is sent to the model at most once per version (content_hash).
 * - Every fact keeps its source record, a verbatim quote, and a page for documents.
 * - Tasks and expenses are mapped deterministically: exact data needs no AI.
 */

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY
const TEXT_MODEL = process.env.TEXT_MODEL ?? "claude-haiku-4-5-20251001";
const DOC_MODEL = process.env.DOC_MODEL ?? "claude-sonnet-5-5";
const CONCURRENCY = Number(process.env.EXTRACT_CONCURRENCY ?? 4);
const TEXT_BATCH_SIZE = 15;
const TEXT_BATCH_CHARS = 40_000;
const AI_TEXT_RESOURCES = ["notes", "communications", "calendar_entries"];

type Item = { resource: string; clioId: number; contentHash: string; data: Record<string, unknown> };
type RawFact = {
  sourceId?: number;
  kind: FactKind;
  title: string;
  detail?: string | null;
  date?: string | null;
  amount?: number | null;
  importance: number;
  providerContactId?: number | null;
  shareableByDefault: boolean;
  quote: string;
  page?: number | null;
};
type FactInput = Omit<Fact, "id" | "matterId" | "firstSeenAt" | "source">;
// The few Clio task/expense fields the deterministic mapping reads.
type TaskOrExpense = {
  name?: string; description?: string | null; status?: string; completed_at?: string | null; due_at?: string | null;
  assignee?: { name?: string } | null;
  note?: string | null; expense_category?: { name?: string } | null; date?: string | null; total?: number | string | null; price?: number | string | null;
};
type Context = { matterId: number; header: string; contactIds: Set<number> };

export type ExtractSummary = {
  matterId: number;
  processed: Record<string, number>;
  skippedUnchanged: number;
  factsWritten: number;
  errors: string[];
  inputTokens: number;
  outputTokens: number;
};

// ---------- tool schema: forces structured, validated output ----------

const factProperties = {
  kind: { type: "string", enum: [...FACT_KINDS] },
  title: { type: "string", description: "Short, specific headline (max ~12 words)." },
  detail: { type: ["string", "null"], description: "One or two sentences of context." },
  date: { type: ["string", "null"], description: "ISO date (YYYY-MM-DD) the fact refers to, if stated or clearly derivable. Never guess." },
  amount: { type: ["number", "null"], description: "Dollar amount, for bills, expenses, coverage limits, case value." },
  importance: { type: "integer", minimum: 1, maximum: 5 },
  providerContactId: { type: ["integer", "null"], description: "ID from the contacts list, only if the fact concerns that provider." },
  shareableByDefault: { type: "boolean" },
  quote: { type: "string", description: "Verbatim excerpt (max 30 words) from the source supporting this fact." },
  page: { type: ["integer", "null"], description: "1-based page number within the provided document, for documents only." },
} as const;

function recordFactsTool(withSourceId: boolean, withPhotoFlag: boolean): Anthropic.Tool {
  const factSchema = {
    type: "object",
    properties: withSourceId
      ? { sourceId: { type: "integer", description: "The id of the record this fact came from." }, ...factProperties }
      : factProperties,
    required: [...(withSourceId ? ["sourceId"] : []), "kind", "title", "importance", "shareableByDefault", "quote"],
  };
  return {
    name: "record_facts",
    description: "Record every case-relevant fact found in the provided source material.",
    input_schema: {
      type: "object",
      properties: {
        facts: { type: "array", items: factSchema },
        ...(withPhotoFlag
          ? { isPortraitPhoto: { type: "boolean", description: "True if this image is a photo of a person's face/portrait." } }
          : {}),
      },
      required: ["facts"],
    },
  };
}

const SYSTEM_PROMPT = `You extract structured facts from a personal-injury case file for a law firm's case dashboard.

Rules:
- Only record facts the source actually states. Never invent dates, amounts, names, or diagnoses. Use null when unknown.
- Every fact needs a verbatim quote from the source that supports it.
- Prefer fewer, meaningful facts over many trivial ones. Skip boilerplate, signatures, and formatting.
- Kinds:
  injury: a diagnosed or claimed injury. treatment: a visit, procedure, therapy session, missed appointment.
  deadline: a court date, statute of limitations, filing or response due date.
  coverage: an insurance policy, carrier, policy limits, claim number, coverage acceptance or denial.
  case_value: an estimated or demanded value, offer, or settlement figure.
  medical_bill: a provider charge, balance, or lien amount. expense: a firm cost on the case.
  client_contact: any actual communication with the client (call, meeting, email, text), with its date.
  status_change: the case moved stage (demand sent, suit filed, deposition, mediation, offer, settlement).
  request_to_provider: something the firm needs from a medical provider (records, bills, narrative report).
  key_event: anything else an attorney would want to know (the incident itself, liability facts, witnesses).
- importance: 5 = changes case value or a hard deadline; 4 = attorney must know; 3 = useful; 2 = minor; 1 = trivia.
- shareableByDefault: true for treatment, medical bills/records, case status, requests to providers, and the bare existence of coverage.
  false for case strategy, valuation, liability analysis, negotiation positions, settlement amounts, internal opinions, and client confidences.
- providerContactId: only use IDs from the provided contacts list.`;

// ---------- helpers ----------

const hashOf = (v: unknown) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");

function factId(resource: string, clioId: number, kind: string, title: string, date?: string | null) {
  return crypto
    .createHash("sha1")
    .update([resource, clioId, kind, title.trim().toLowerCase(), date ?? ""].join("|"))
    .digest("hex")
    .slice(0, 16);
}

function clampImportance(n: number): Fact["importance"] {
  return Math.min(5, Math.max(1, Math.round(n))) as Fact["importance"];
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let next = queue.shift(); next !== undefined; next = queue.shift()) await fn(next);
    })
  );
}

function logCall(matterId: number, model: string, purpose: string, usage: Anthropic.Usage, summary: ExtractSummary) {
  db.prepare(
    "INSERT INTO llm_calls (matter_id, model, purpose, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(matterId, model, purpose, usage.input_tokens, usage.output_tokens, new Date().toISOString());
  summary.inputTokens += usage.input_tokens;
  summary.outputTokens += usage.output_tokens;
}

/** Replace all facts from one source record, keeping firstSeenAt for facts that already existed. */
const writeFactsForSource = db.transaction(
  (
    matterId: number,
    resource: string,
    clioId: number,
    contentHash: string,
    facts: FactInput[],
    sources: { quote: string; page?: number }[],
    flags: Record<string, unknown> | null,
    error: string | null
  ) => {
    const previous = new Map(
      (db.prepare("SELECT id, first_seen_at FROM facts WHERE source_resource = ? AND source_clio_id = ?").all(resource, clioId) as { id: string; first_seen_at: string }[])
        .map((r) => [r.id, r.first_seen_at])
    );
    db.prepare("DELETE FROM facts WHERE source_resource = ? AND source_clio_id = ?").run(resource, clioId);

    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT OR REPLACE INTO facts (id, matter_id, kind, title, detail, date, amount, importance, provider_contact_id,
        shareable_by_default, status, assignee, source_resource, source_clio_id, source_quote, source_page, first_seen_at)
       VALUES (@id, @matterId, @kind, @title, @detail, @date, @amount, @importance, @providerContactId,
        @shareable, @status, @assignee, @resource, @clioId, @quote, @page, @firstSeenAt)`
    );
    facts.forEach((fact, i) => {
      const id = factId(resource, clioId, fact.kind, fact.title, fact.date);
      insert.run({
        id, matterId, kind: fact.kind, title: fact.title, detail: fact.detail ?? null, date: fact.date ?? null,
        amount: fact.amount ?? null, importance: fact.importance, providerContactId: fact.providerContactId ?? null,
        shareable: fact.shareableByDefault ? 1 : 0, status: fact.status ?? null, assignee: fact.assignee ?? null,
        resource, clioId, quote: sources[i].quote, page: sources[i].page ?? null,
        firstSeenAt: previous.get(id) ?? now,
      });
    });

    db.prepare(
      `INSERT INTO extractions (resource, clio_id, matter_id, content_hash, extracted_at, flags, error) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(resource, clio_id) DO UPDATE SET content_hash = excluded.content_hash, extracted_at = excluded.extracted_at,
         flags = excluded.flags, error = excluded.error`
    ).run(resource, clioId, matterId, contentHash, now, flags ? JSON.stringify(flags) : null, error);
  }
);

function saveRawFacts(ctx: Context, item: Item, raw: RawFact[], flags: Record<string, unknown> | null = null, pageOffset = 0) {
  const clean = raw.filter((f) => FACT_KINDS.includes(f.kind) && f.title && f.quote);
  writeFactsForSource(
    ctx.matterId, item.resource, item.clioId, item.contentHash,
    clean.map((f) => ({
      kind: f.kind,
      title: f.title.trim(),
      detail: f.detail ?? undefined,
      date: f.date ?? undefined,
      amount: f.amount ?? undefined,
      importance: clampImportance(f.importance),
      providerContactId: f.providerContactId && ctx.contactIds.has(f.providerContactId) ? f.providerContactId : undefined,
      shareableByDefault: Boolean(f.shareableByDefault),
    })),
    clean.map((f) => ({ quote: f.quote, page: f.page ? f.page + pageOffset : undefined })),
    flags,
    null
  );
  return clean.length;
}

function recordError(ctx: Context, item: Item, message: string, summary: ExtractSummary) {
  summary.errors.push(`${item.resource} ${item.clioId}: ${message}`);
  // Don't store the hash, so the item is retried on the next run.
  db.prepare(
    `INSERT INTO extractions (resource, clio_id, matter_id, content_hash, extracted_at, flags, error) VALUES (?, ?, ?, '', ?, NULL, ?)
     ON CONFLICT(resource, clio_id) DO UPDATE SET content_hash = '', extracted_at = excluded.extracted_at, error = excluded.error`
  ).run(item.resource, item.clioId, ctx.matterId, new Date().toISOString(), message);
}

async function callModel(model: string, maxTokens: number, tool: Anthropic.Tool, content: Anthropic.ContentBlockParam[]) {
  const res = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content }],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (res.stop_reason === "max_tokens" || !toolUse) throw new TruncatedError();
  return { input: toolUse.input as { facts: RawFact[]; isPortraitPhoto?: boolean }, usage: res.usage };
}
class TruncatedError extends Error {
  constructor() { super("model output truncated"); }
}

// ---------- context: matter header + contacts, generic for any matter ----------

function buildContext(matterId: number): Context {
  const matterRow = db.prepare("SELECT data FROM matters WHERE clio_id = ?").get(matterId) as { data: string } | undefined;
  if (!matterRow) throw new Error(`Matter ${matterId} has not been synced yet. Run a sync first.`);
  const matter = JSON.parse(matterRow.data);

  const relationships = (db.prepare("SELECT data FROM items WHERE matter_id = ? AND resource = 'relationships'").all(matterId) as { data: string }[])
    .map((r) => JSON.parse(r.data));
  const contacts = relationships
    .filter((r) => r.contact?.id)
    .map((r) => ({ id: r.contact.id as number, name: r.contact.name as string, role: r.description as string | undefined }));
  if (matter.client?.id) contacts.unshift({ id: matter.client.id, name: matter.client.name, role: "Client" });

  const header = [
    `Today's date: ${new Date().toISOString().slice(0, 10)}`,
    `Matter: ${matter.display_number ?? matterId}: ${matter.description ?? ""}`,
    `Client: ${matter.client?.name ?? "unknown"}`,
    `Contacts (id: name, role):`,
    ...contacts.map((c) => `  ${c.id}: ${c.name}${c.role ? `, ${c.role}` : ""}`),
  ].join("\n");

  return { matterId, header, contactIds: new Set(contacts.map((c) => c.id)) };
}

// ---------- the pipeline ----------

function pendingItems(matterId: number, resources: string[]): Item[] {
  const rows = db
    .prepare(
      `SELECT i.resource, i.clio_id, i.content_hash, i.data FROM items i
       LEFT JOIN extractions e ON e.resource = i.resource AND e.clio_id = i.clio_id
       WHERE i.matter_id = ? AND i.resource IN (${resources.map(() => "?").join(",")})
         AND (e.content_hash IS NULL OR e.content_hash != i.content_hash)`
    )
    .all(matterId, ...resources) as { resource: string; clio_id: number; content_hash: string; data: string }[];
  return rows.map((r) => ({ resource: r.resource, clioId: r.clio_id, contentHash: r.content_hash, data: JSON.parse(r.data) }));
}

export async function extractMatter(matterId: number, { force = false } = {}): Promise<ExtractSummary> {
  const summary: ExtractSummary = { matterId, processed: {}, skippedUnchanged: 0, factsWritten: 0, errors: [], inputTokens: 0, outputTokens: 0 };
  if (force) db.prepare("DELETE FROM extractions WHERE matter_id = ?").run(matterId);
  const ctx = buildContext(matterId);
  const bump = (r: string, n = 1) => (summary.processed[r] = (summary.processed[r] ?? 0) + n);

  const totalItems = (db.prepare("SELECT COUNT(*) AS n FROM items WHERE matter_id = ? AND resource NOT IN ('relationships','contacts')").get(matterId) as { n: number }).n;

  // 1. Deterministic: tasks and expenses.
  for (const item of pendingItems(matterId, ["tasks", "expenses"])) {
    const d = item.data as TaskOrExpense;
    if (item.resource === "tasks") {
      const done = Boolean(d.completed_at) || String(d.status ?? "").toLowerCase() === "complete";
      const overdue = !done && d.due_at && new Date(d.due_at) < new Date();
      writeFactsForSource(matterId, "tasks", item.clioId, item.contentHash, [{
        kind: "task", title: String(d.name ?? "Task"), detail: d.description ?? undefined, date: d.due_at ?? undefined,
        importance: overdue ? 4 : done ? 2 : 3, shareableByDefault: false,
        status: done ? "complete" : String(d.status ?? "pending"), assignee: d.assignee?.name ?? undefined,
      }], [{ quote: String(d.name ?? "") }], null, null);
    } else {
      const label = d.note || d.expense_category?.name || "Case expense";
      writeFactsForSource(matterId, "expenses", item.clioId, item.contentHash, [{
        kind: "expense", title: String(label).slice(0, 120), date: d.date ?? undefined,
        amount: typeof d.total === "number" ? d.total : Number(d.total ?? d.price ?? 0) || undefined,
        importance: 2, shareableByDefault: false,
      }], [{ quote: String(label).slice(0, 200) }], null, null);
    }
    bump(item.resource);
    summary.factsWritten++;
  }

  // 2. The matter record itself: custom fields often hold case value, coverage, liability.
  const matterRow = db.prepare("SELECT data FROM matters WHERE clio_id = ?").get(matterId) as { data: string };
  const matterItem: Item = { resource: "matter", clioId: matterId, contentHash: hashOf(matterRow.data), data: JSON.parse(matterRow.data) };
  const matterDone = db.prepare("SELECT content_hash FROM extractions WHERE resource = 'matter' AND clio_id = ?").get(matterId) as { content_hash: string } | undefined;
  const textItems = pendingItems(matterId, AI_TEXT_RESOURCES);
  if (matterDone?.content_hash !== matterItem.contentHash) textItems.unshift(matterItem);

  // 3. Text records, batched so attribution stays per-record via sourceId.
  const batches: Item[][] = [];
  let current: Item[] = [];
  let chars = 0;
  for (const item of textItems) {
    const size = JSON.stringify(item.data).length;
    if (current.length && (current.length >= TEXT_BATCH_SIZE || chars + size > TEXT_BATCH_CHARS)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += size;
  }
  if (current.length) batches.push(current);

  const runTextBatch = async (batch: Item[]): Promise<void> => {
    const body = batch
      .map((it) => `<record sourceId="${it.clioId}" type="${it.resource}">\n${JSON.stringify(it.data)}\n</record>`)
      .join("\n\n");
    try {
      const { input, usage } = await callModel(TEXT_MODEL, 8000, recordFactsTool(true, false), [
        { type: "text", text: `${ctx.header}\n\nExtract facts from these case records. Set sourceId on every fact.\n\n${body}` },
      ]);
      logCall(matterId, TEXT_MODEL, "text", usage, summary);
      for (const item of batch) {
        summary.factsWritten += saveRawFacts(ctx, item, (input.facts ?? []).filter((f) => Number(f.sourceId) === item.clioId));
        bump(item.resource);
      }
    } catch (e) {
      if (e instanceof TruncatedError && batch.length > 1) {
        const mid = Math.ceil(batch.length / 2);
        await runTextBatch(batch.slice(0, mid));
        await runTextBatch(batch.slice(mid));
        return;
      }
      for (const item of batch) recordError(ctx, item, (e as Error).message, summary);
    }
  };
  await pool(batches, CONCURRENCY, runTextBatch);

  // 4. Documents: native PDF/image reading (handles scans), chunked for long files.
  const docItems = pendingItems(matterId, ["documents"]);
  await pool(docItems, CONCURRENCY, async (item) => {
    const file = db.prepare("SELECT path, content_type FROM document_files WHERE document_id = ?").get(item.clioId) as
      { path: string; content_type: string | null } | undefined;
    if (!file) return recordError(ctx, item, "file not downloaded yet (run sync)", summary);

    try {
      const chunks = await documentToChunks(file.path, file.content_type);
      const allFacts: { raw: RawFact; offset: number }[] = [];
      let isPortraitPhoto = false;
      for (const chunk of chunks) {
        const range = chunk.pageRange && chunks.length > 1
          ? ` This excerpt is pages ${chunk.pageRange[0]}-${chunk.pageRange[1]} of the original; report page numbers relative to this excerpt (its first page is page 1).`
          : "";
        const { input, usage } = await callModel(DOC_MODEL, 16000, recordFactsTool(false, chunk.isImage), [
          ...chunk.blocks,
          { type: "text", text: `${ctx.header}\n\nDocument: "${String(item.data.name ?? item.clioId)}".${range}\nExtract facts from this document. Include the page for each fact.` },
        ]);
        logCall(matterId, DOC_MODEL, "document", usage, summary);
        allFacts.push(...(input.facts ?? []).map((raw) => ({ raw, offset: chunk.pageOffset })));
        if (input.isPortraitPhoto) isPortraitPhoto = true;
      }
      // Apply each chunk's page offset before saving.
      const adjusted = allFacts.map(({ raw, offset }) => ({ ...raw, page: raw.page ? raw.page + offset : raw.page }));
      summary.factsWritten += saveRawFacts(ctx, item, adjusted, { isPortraitPhoto, isImage: chunks[0]?.isImage ?? false });
      bump("documents");
    } catch (e) {
      const message = e instanceof UnsupportedDocumentError ? `skipped: ${e.message}` : (e as Error).message;
      recordError(ctx, item, message, summary);
    }
  });

  const processedCount = Object.values(summary.processed).reduce((a, b) => a + b, 0);
  summary.skippedUnchanged = Math.max(0, totalItems - processedCount - summary.errors.length);
  return summary;
}
