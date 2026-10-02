import { db } from "./db";
import { getDigest, rowToFact } from "./digest";
import type { Fact } from "./types";

export function positiveId(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !/^[1-9]\d*$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

export function getFact(id: string): Fact | null {
  const row = db.prepare("SELECT * FROM facts WHERE id = ?").get(id);
  return row ? rowToFact(row as Parameters<typeof rowToFact>[0]) : null;
}

export function isShared(fact: Fact, providerContactId?: number): boolean {
  if (fact.kind === "case_value" || fact.kind === "expense") return false;
  if (providerContactId !== undefined && fact.providerContactId !== undefined && fact.providerContactId !== providerContactId) return false;
  const specific = providerContactId === undefined ? undefined : db.prepare(
    "SELECT shared FROM fact_visibility WHERE fact_id = ? AND provider_contact_id = ?"
  ).get(fact.id, providerContactId) as { shared: number } | undefined;
  const global = db.prepare("SELECT shared FROM fact_visibility WHERE fact_id = ? AND provider_contact_id IS NULL")
    .get(fact.id) as { shared: number } | undefined;
  return Boolean(specific?.shared ?? global?.shared ?? fact.shareableByDefault);
}

export function setVisibility(factId: string, shared: boolean, providerContactId?: number) {
  db.transaction(() => {
    clearVisibility(factId, providerContactId);
    db.prepare("INSERT INTO fact_visibility (fact_id, provider_contact_id, shared, updated_at) VALUES (?, ?, ?, ?)")
      .run(factId, providerContactId ?? null, Number(shared), new Date().toISOString());
  })();
}

export function clearVisibility(factId: string, providerContactId?: number) {
  if (providerContactId === undefined) {
    db.prepare("DELETE FROM fact_visibility WHERE fact_id = ? AND provider_contact_id IS NULL").run(factId);
  } else {
    db.prepare("DELETE FROM fact_visibility WHERE fact_id = ? AND provider_contact_id = ?").run(factId, providerContactId);
  }
}

export function getProviderDigest(matterId: number, providerContactId?: number, since?: string) {
  const digest = getDigest(matterId, since);
  if (!digest) return null;
  return {
    matter: { id: digest.matter.id, displayNumber: digest.matter.displayNumber, status: digest.matter.status },
    facts: digest.facts.filter(f => isShared(f, providerContactId)),
    lastExtractedAt: digest.lastExtractedAt,
  };
}
