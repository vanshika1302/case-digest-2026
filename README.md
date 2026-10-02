# Case Digest

A dashboard that digests a live personal-injury case file from Clio Manage, for two audiences:

1. **The firm**: get up to speed on a case in ninety seconds, with every fact traceable to its source.
2. **Treating medical providers**: see where the case stands, without the attorney handing over the whole file.

Built for the Swans Applied AI Hackathon (Law-Di-Gras, San Diego, October 2026).

## How it works

```
Clio Manage ──(read-only GET)──▶ sync ──▶ SQLite ──▶ AI extraction ──▶ facts with citations ──▶ dashboards
```

- **Read-only by construction.** `clioGet()` in `src/lib/clio.ts` is the only function that calls the Clio API, and it only issues GET requests. The Clio app is registered with read scopes only.
- **Nothing is hardcoded.** The matter is chosen at runtime. All case data lives in a local SQLite database outside Clio (`data/`, git-ignored).
- **Digest once.** Every Clio record is hashed. A record is sent to the model only when it is new or has changed, so opening a case never re-digests it. Incremental sync uses Clio's `updated_since`.
- **Cite everything.** Every fact stores its source record, a verbatim quote, and for documents the page number. Any fact on screen opens the note, email, or document page it came from.
- **Scanned PDFs.** PDFs go to Claude natively, which reads scanned pages visually. Long files are split into chunks with page offsets, so citations point to the right page of the original.
- **Exact data stays exact.** Tasks and expenses are mapped deterministically, without AI.

## Stack

- Next.js (App Router, TypeScript), Tailwind, running locally on Node
- SQLite via better-sqlite3: all data outside Clio lives here
- Anthropic Claude: a fast model for notes/emails/calendar (batched), a stronger model for documents and scans
- pdf-lib (PDF chunking), mammoth (.docx text)

## Run it

```bash
npm install
cp .env.example .env.local   # fill in Clio + Anthropic keys
npm run dev
```

Open **http://127.0.0.1:3000** (not localhost: Clio only accepts 127.0.0.1 redirect URIs), connect Clio, then on the matter click **Full sync** and **Extract facts**.

### Register the Clio app

At developers.clio.com, create an app with Website URL `http://127.0.0.1:3000`, Redirect URI `http://127.0.0.1:3000/api/auth/callback`, and **Read** permission only on every scope.

## Dashboard

- `/demo`: a fictional sample case, no keys needed. Good for exploring the UI.
- `/matter/:id`: the live dashboard for a synced matter, with two views:
  - **Firm view**: key numbers (next deadline, medical specials, policy limit, working value), facts grouped by kind and ranked by importance, search, "what changed since" filter, and a per-fact **Share** toggle.
  - **Provider view**: only facts marked shareable, filterable by provider. Coverage, case value, and strategy stay private.
- Every fact has a **Source** button that opens the quote, the full Clio record, and the document at the cited page.

## API

| Route | Purpose |
|---|---|
| `GET /api/auth/login` | Start Clio OAuth |
| `GET /api/matters` | List matters |
| `POST /api/sync` `{ matterId, full? }` | Pull a matter from Clio (incremental by default) |
| `POST /api/matters/:id/extract` `{ force? }` | Extract facts from new/changed records |
| `GET /api/matters/:id/facts?since=ISO` | The digest: matter, contacts, cited facts, usage and cost |
| `GET /api/source/:resource/:id` | The original record behind a fact |
| `GET /api/documents/:id/file` | A synced document (append `#page=N` for PDFs) |

## Code map

- `src/lib/clio.ts`: OAuth, read-only API client, pagination, rate-limit retries
- `src/lib/resources.ts`: which Clio resources and fields are pulled
- `src/lib/ingest.ts`: sync into SQLite with change tracking, document downloads
- `src/lib/extract.ts`: AI extraction into cited facts
- `src/lib/documents.ts`: PDF/image/docx handling and chunking
- `src/lib/digest.ts`: assembles the digest served to the UIs
- `src/lib/types.ts`: the shared `Fact` / `MatterDigest` contract
