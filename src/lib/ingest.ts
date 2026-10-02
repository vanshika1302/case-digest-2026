import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, DATA_DIR } from "./db";
import { clioGet, clioGetOneWithFallback, clioList, clioListWithFallback } from "./clio";
import { CONTACT_FIELD_SETS, MATTER_FIELD_SETS, RESOURCES } from "./resources";

type ClioRecord = { id: number; updated_at?: string; [key: string]: unknown };
type ChangeKind = "new" | "changed" | "unchanged";

export type SyncSummary = {
  matterId: number;
  startedAt: string;
  finishedAt: string;
  mode: "full" | "incremental";
  resources: Record<string, { fetched: number; new: number; changed: number; error?: string }>;
  documentsDownloaded: number;
  documentErrors: string[];
};

export async function listMatters() {
  return clioList<ClioRecord>("matters.json", {
    fields: "id,display_number,description,status,client{id,name}",
  });
}

const hash = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function upsertItem(resource: string, matterId: number, record: ClioRecord, now: string): ChangeKind {
  const contentHash = hash(record);
  const existing = db
    .prepare("SELECT content_hash FROM items WHERE resource = ? AND clio_id = ?")
    .get(resource, record.id) as { content_hash: string } | undefined;

  if (existing?.content_hash === contentHash) return "unchanged";

  db.prepare(
    `INSERT INTO items (resource, clio_id, matter_id, updated_at, data, content_hash, first_seen_at, last_changed_at)
     VALUES (@resource, @id, @matterId, @updatedAt, @data, @hash, @now, @now)
     ON CONFLICT(resource, clio_id) DO UPDATE SET
       updated_at = excluded.updated_at, data = excluded.data,
       content_hash = excluded.content_hash, last_changed_at = excluded.last_changed_at`
  ).run({
    resource,
    id: record.id,
    matterId,
    updatedAt: record.updated_at ?? null,
    data: JSON.stringify(record),
    hash: contentHash,
    now,
  });
  return existing ? "changed" : "new";
}

function lastSynced(matterId: number, resource: string): string | undefined {
  const row = db
    .prepare("SELECT last_synced_at FROM sync_state WHERE matter_id = ? AND resource = ?")
    .get(matterId, resource) as { last_synced_at: string } | undefined;
  return row?.last_synced_at;
}

function markSynced(matterId: number, resource: string, at: string) {
  db.prepare(
    `INSERT INTO sync_state (matter_id, resource, last_synced_at) VALUES (?, ?, ?)
     ON CONFLICT(matter_id, resource) DO UPDATE SET last_synced_at = excluded.last_synced_at`
  ).run(matterId, resource, at);
}

function storedRecords(matterId: number, resource: string): ClioRecord[] {
  const rows = db
    .prepare("SELECT data FROM items WHERE matter_id = ? AND resource = ?")
    .all(matterId, resource) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as ClioRecord);
}

function tally(summary: SyncSummary, resource: string, kind?: ChangeKind) {
  const entry = (summary.resources[resource] ??= { fetched: 0, new: 0, changed: 0 });
  if (!kind) return;
  entry.fetched++;
  if (kind === "new") entry.new++;
  if (kind === "changed") entry.changed++;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Pull one matter from Clio into SQLite. Incremental by default; pass full=true to refetch everything. */
export async function syncMatter(matterId: number, { full = false } = {}): Promise<SyncSummary> {
  const startedAt = new Date().toISOString();
  const summary: SyncSummary = {
    matterId,
    startedAt,
    finishedAt: startedAt,
    mode: full ? "full" : "incremental",
    resources: {},
    documentsDownloaded: 0,
    documentErrors: [],
  };

  // 1. The matter itself (native + custom fields).
  const matter = await clioGetOneWithFallback<ClioRecord>(`matters/${matterId}.json`, MATTER_FIELD_SETS);
  db.prepare(
    `INSERT INTO matters (clio_id, display_number, description, data, synced_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(clio_id) DO UPDATE SET display_number = excluded.display_number,
       description = excluded.description, data = excluded.data, synced_at = excluded.synced_at`
  ).run(matterId, String(matter.display_number ?? ""), String(matter.description ?? ""), JSON.stringify(matter), startedAt);

  // 2. Every child resource. One failure is recorded, not fatal.
  for (const def of RESOURCES) {
    tally(summary, def.name);
    try {
      const since = full ? undefined : lastSynced(matterId, def.name);
      const records = await clioListWithFallback<ClioRecord>(
        def.path,
        { ...def.params, matter_id: matterId, updated_since: since },
        def.fieldSets
      );
      for (const record of records) tally(summary, def.name, upsertItem(def.name, matterId, record, startedAt));
      markSynced(matterId, def.name, startedAt);
    } catch (e) {
      summary.resources[def.name].error = errorMessage(e);
    }
  }

  // 3. Full contact cards for the client and every related contact (providers, insurers, ...).
  tally(summary, "contacts");
  const contactIds = new Set<number>();
  const client = matter.client as { id?: number } | undefined;
  if (client?.id) contactIds.add(client.id);
  for (const rel of storedRecords(matterId, "relationships")) {
    const contact = rel.contact as { id?: number } | undefined;
    if (contact?.id) contactIds.add(contact.id);
  }
  for (const id of contactIds) {
    try {
      const contact = await clioGetOneWithFallback<ClioRecord>(`contacts/${id}.json`, CONTACT_FIELD_SETS);
      tally(summary, "contacts", upsertItem("contacts", matterId, contact, startedAt));
    } catch (e) {
      summary.resources.contacts.error = errorMessage(e);
    }
  }

  // 4. Download document files whose latest version we don't have yet.
  for (const doc of storedRecords(matterId, "documents")) {
    try {
      if (await downloadDocumentIfNeeded(matterId, doc)) summary.documentsDownloaded++;
    } catch (e) {
      summary.documentErrors.push(`${doc.name ?? doc.id}: ${errorMessage(e)}`);
    }
  }

  summary.finishedAt = new Date().toISOString();
  return summary;
}

async function downloadDocumentIfNeeded(matterId: number, doc: ClioRecord): Promise<boolean> {
  const version = doc.latest_document_version as { id?: number; content_type?: string } | undefined;
  const versionId = version?.id ?? null;
  const existing = db
    .prepare("SELECT version_id, path FROM document_files WHERE document_id = ?")
    .get(doc.id) as { version_id: number | null; path: string } | undefined;
  if (existing && existing.version_id === versionId && fs.existsSync(existing.path)) return false;

  // Clio answers with a redirect to file storage. Follow it manually so the
  // Clio bearer token is never sent to the storage host.
  let res = await clioGet(`documents/${doc.id}/download`, {}, { redirect: "manual" });
  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && location) {
    res = await fetch(location);
    if (!res.ok) throw new Error(`storage download failed: ${res.status}`);
  }

  const safeName = String(doc.name ?? `document-${doc.id}`).replace(/[^\w.\- ]+/g, "_");
  const dir = path.join(DATA_DIR, "documents", String(matterId));
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${doc.id}-${safeName}`);
  fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));

  db.prepare(
    `INSERT INTO document_files (document_id, matter_id, version_id, path, content_type, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(document_id) DO UPDATE SET version_id = excluded.version_id, path = excluded.path,
       content_type = excluded.content_type, downloaded_at = excluded.downloaded_at`
  ).run(
    doc.id,
    matterId,
    versionId,
    filePath,
    version?.content_type ?? (doc.content_type as string | undefined) ?? res.headers.get("content-type"),
    new Date().toISOString()
  );
  return true;
}

export function matterStats(matterId: number) {
  const counts = db
    .prepare("SELECT resource, COUNT(*) AS count FROM items WHERE matter_id = ? GROUP BY resource")
    .all(matterId);
  const files = db.prepare("SELECT COUNT(*) AS count FROM document_files WHERE matter_id = ?").get(matterId);
  const matter = db.prepare("SELECT display_number, description, synced_at FROM matters WHERE clio_id = ?").get(matterId);
  return { matter, counts, documentFiles: files };
}
