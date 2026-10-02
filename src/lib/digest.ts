import { db } from "./db";
import type { Fact, FactKind, MatterDigest } from "./types";

type FactRow = {
  id: string; matter_id: number; kind: string; title: string; detail: string | null; date: string | null;
  amount: number | null; importance: number; provider_contact_id: number | null; shareable_by_default: number;
  status: string | null; assignee: string | null; source_resource: string; source_clio_id: number;
  source_quote: string; source_page: number | null; first_seen_at: string;
};

// Never shared with providers by default, whatever the model decided. The attorney can still opt a fact in.
const PRIVATE_KINDS: FactKind[] = ["case_value", "coverage", "expense", "deadline"];

export function rowToFact(r: FactRow): Fact {
  return {
    id: r.id,
    matterId: r.matter_id,
    kind: r.kind as FactKind,
    title: r.title,
    detail: r.detail ?? undefined,
    date: r.date ?? undefined,
    amount: r.amount ?? undefined,
    importance: r.importance as Fact["importance"],
    providerContactId: r.provider_contact_id ?? undefined,
    shareableByDefault: Boolean(r.shareable_by_default) && !PRIVATE_KINDS.includes(r.kind as FactKind),
    status: r.status ?? undefined,
    assignee: r.assignee ?? undefined,
    source: { resource: r.source_resource, clioId: r.source_clio_id, quote: r.source_quote, page: r.source_page ?? undefined },
    firstSeenAt: r.first_seen_at,
  };
}

/** Optional per-model prices (USD per million tokens), e.g. MODEL_PRICES='{"model-id":{"in":1,"out":5}}'. */
function estimateUsd(rows: { model: string; input: number; output: number }[]): number | null {
  if (!process.env.MODEL_PRICES) return null;
  const prices = JSON.parse(process.env.MODEL_PRICES) as Record<string, { in: number; out: number }>;
  let total = 0;
  for (const r of rows) {
    const p = prices[r.model];
    if (!p) return null;
    total += (r.input * p.in + r.output * p.out) / 1_000_000;
  }
  return Math.round(total * 100) / 100;
}

export function getDigest(matterId: number, since?: string): MatterDigest | null {
  const row = db.prepare("SELECT data FROM matters WHERE clio_id = ?").get(matterId) as { data: string } | undefined;
  if (!row) return null;
  const m = JSON.parse(row.data);

  const facts = (
    since
      ? db.prepare("SELECT * FROM facts WHERE matter_id = ? AND first_seen_at > ? ORDER BY COALESCE(date, first_seen_at) DESC").all(matterId, since)
      : db.prepare("SELECT * FROM facts WHERE matter_id = ? ORDER BY COALESCE(date, first_seen_at) DESC").all(matterId)
  ) as FactRow[];

  const contacts = (db.prepare("SELECT data FROM items WHERE matter_id = ? AND resource = 'relationships'").all(matterId) as { data: string }[])
    .map((r) => JSON.parse(r.data))
    .filter((r) => r.contact?.id)
    .map((r) => ({ id: r.contact.id, name: r.contact.name, role: r.description ?? undefined, type: r.contact.type ?? undefined }));

  const photo = (db.prepare("SELECT clio_id, flags FROM extractions WHERE matter_id = ? AND resource = 'documents' AND flags IS NOT NULL").all(matterId) as { clio_id: number; flags: string }[])
    .find((e) => JSON.parse(e.flags).isPortraitPhoto);

  const last = db.prepare("SELECT MAX(extracted_at) AS at FROM extractions WHERE matter_id = ?").get(matterId) as { at: string | null };
  const usageRows = db
    .prepare("SELECT model, SUM(input_tokens) AS input, SUM(output_tokens) AS output, COUNT(*) AS calls FROM llm_calls WHERE matter_id = ? GROUP BY model")
    .all(matterId) as { model: string; input: number; output: number; calls: number }[];

  return {
    matter: {
      id: m.id,
      displayNumber: m.display_number,
      description: m.description,
      status: m.status,
      openDate: m.open_date,
      client: m.client?.id ? { id: m.client.id, name: m.client.name } : undefined,
      customFields: (m.custom_field_values ?? []).map((c: { field_name?: string; id: string; value: unknown }) => ({
        name: c.field_name ?? String(c.id),
        value: c.value,
      })),
    },
    contacts,
    clientPhotoDocumentId: photo?.clio_id,
    facts: facts.map(rowToFact),
    lastExtractedAt: last.at ?? undefined,
    usage: {
      calls: usageRows.reduce((a, r) => a + r.calls, 0),
      inputTokens: usageRows.reduce((a, r) => a + r.input, 0),
      outputTokens: usageRows.reduce((a, r) => a + r.output, 0),
      estimatedUsd: estimateUsd(usageRows),
    },
  };
}
