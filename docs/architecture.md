# Architecture

```
Clio Manage ──(read-only GET)──▶ sync ──▶ SQLite ──▶ AI extraction ──▶ cited facts ──▶ dashboards
                                  │                      │
                       items + content hash        Claude (tool use)
```

## Pieces

- **Clio client** (`src/lib/clio.ts`): OAuth and the only code that calls Clio. GET only, with pagination and 429 retry (honours `Retry-After`).
- **Sync** (`src/lib/ingest.ts`): pulls a matter and its notes, communications, tasks, calendar entries, documents, expenses and relationships. Every record is hashed. Incremental sync uses `updated_since`. Document files are downloaded to `data/documents/`.
- **Resources** (`src/lib/resources.ts`): which Clio resources and fields are pulled. Each has fallback field sets, because Clio rejects unknown fields.
- **Extraction** (`src/lib/extract.ts`, `documents.ts`): turns new or changed records into facts. See [extraction.md](extraction.md).
- **Digest** (`src/lib/digest.ts`): assembles the `MatterDigest` served to the UIs. Applies the privacy rules in [privacy.md](privacy.md).
- **UI** (`src/app`, `src/components/Dashboard.tsx`): landing page, `/matter/:id` (firm and provider views), `/demo`.
- **Storage** (`src/lib/db.ts`): one SQLite file at `data/case-digest.db`. Everything outside Clio lives here.

## Principles

1. **Read-only toward Clio.** Nothing the app does can modify a case file.
2. **Digest once.** A record is sent to the model only if its content hash is new or changed.
3. **Cite everything.** Each fact carries its source record, a verbatim quote, and for documents the page.
4. **Exact data stays exact.** Tasks and expenses are mapped without AI.
5. **Privacy is enforced in code, not by the model.** See [privacy.md](privacy.md).

## Request flow

1. `GET /api/auth/login` → Clio OAuth → `/api/auth/callback` stores the token.
2. `POST /api/sync` pulls the matter into SQLite.
3. `POST /api/matters/:id/extract` extracts facts from new or changed records.
4. `GET /api/matters/:id/facts` returns the digest. The dashboard renders it.
5. `GET /api/source/:resource/:id` and `/api/documents/:id/file` serve the record behind any fact.

`/demo` and `GET /api/demo` serve fictional data from `src/lib/demo.ts` and need no keys.

## Boundaries between teammates

`src/lib/types.ts` (`Fact`, `MatterDigest`) is the contract between the pipeline and the UIs. UI work should not need pipeline changes, and the reverse. Change the contract only by team agreement.
