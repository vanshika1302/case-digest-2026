import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// All data lives OUTSIDE Clio, in a local SQLite file. Clio is read-only input.
export const DATA_DIR = path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const globalForDb = globalThis as unknown as { __caseDigestDb?: Database.Database };

function open(): Database.Database {
  const db = new Database(path.join(DATA_DIR, "case-digest.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      expires_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matters (
      clio_id        INTEGER PRIMARY KEY,
      display_number TEXT,
      description    TEXT,
      data           TEXT NOT NULL,
      synced_at      TEXT NOT NULL
    );

    -- One row per Clio record (note, email, task, document, ...).
    -- content_hash + last_changed_at let us re-run AI only on what changed,
    -- and power "what changed since I last opened this matter".
    CREATE TABLE IF NOT EXISTS items (
      resource        TEXT NOT NULL,
      clio_id         INTEGER NOT NULL,
      matter_id       INTEGER NOT NULL,
      updated_at      TEXT,
      data            TEXT NOT NULL,
      content_hash    TEXT NOT NULL,
      first_seen_at   TEXT NOT NULL,
      last_changed_at TEXT NOT NULL,
      PRIMARY KEY (resource, clio_id)
    );
    CREATE INDEX IF NOT EXISTS idx_items_matter ON items (matter_id, resource);

    CREATE TABLE IF NOT EXISTS sync_state (
      matter_id      INTEGER NOT NULL,
      resource       TEXT NOT NULL,
      last_synced_at TEXT NOT NULL,
      PRIMARY KEY (matter_id, resource)
    );

    CREATE TABLE IF NOT EXISTS document_files (
      document_id   INTEGER PRIMARY KEY,
      matter_id     INTEGER NOT NULL,
      version_id    INTEGER,
      path          TEXT NOT NULL,
      content_type  TEXT,
      downloaded_at TEXT NOT NULL
    );

    -- AI extraction bookkeeping: one row per source record. If the record's
    -- content_hash changes, it gets re-extracted; otherwise it is never re-sent to the model.
    CREATE TABLE IF NOT EXISTS extractions (
      resource     TEXT NOT NULL,
      clio_id      INTEGER NOT NULL,
      matter_id    INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      extracted_at TEXT NOT NULL,
      flags        TEXT,
      error        TEXT,
      PRIMARY KEY (resource, clio_id)
    );

    CREATE TABLE IF NOT EXISTS facts (
      id                   TEXT PRIMARY KEY,
      matter_id            INTEGER NOT NULL,
      kind                 TEXT NOT NULL,
      title                TEXT NOT NULL,
      detail               TEXT,
      date                 TEXT,
      amount               REAL,
      importance           INTEGER NOT NULL,
      provider_contact_id  INTEGER,
      shareable_by_default INTEGER NOT NULL,
      status               TEXT,
      assignee             TEXT,
      source_resource      TEXT NOT NULL,
      source_clio_id       INTEGER NOT NULL,
      source_quote         TEXT NOT NULL,
      source_page          INTEGER,
      first_seen_at        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_facts_matter ON facts (matter_id, kind);
    CREATE INDEX IF NOT EXISTS idx_facts_source ON facts (source_resource, source_clio_id);

    -- Every model call, for the cost-per-case answer on the submission form.
    CREATE TABLE IF NOT EXISTS llm_calls (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      matter_id     INTEGER NOT NULL,
      model         TEXT NOT NULL,
      purpose       TEXT NOT NULL,
      input_tokens  INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      created_at    TEXT NOT NULL
    );
  `);
  return db;
}

export const db = globalForDb.__caseDigestDb ?? open();
globalForDb.__caseDigestDb = db;
