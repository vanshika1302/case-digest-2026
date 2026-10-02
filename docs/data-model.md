# Data model

All tables are created in `src/lib/db.ts`.

| Table | Purpose |
|---|---|
| `oauth_tokens` | The single Clio token row |
| `matters` | Synced matter JSON |
| `items` | One row per Clio record (`resource`, `clio_id`), with `content_hash`, `first_seen_at`, `last_changed_at` |
| `sync_state` | Last sync time per matter and resource (drives incremental sync) |
| `document_files` | Downloaded document paths and versions |
| `extractions` | Bookkeeping: which record version was extracted, flags, errors |
| `facts` | The extracted facts |
| `llm_calls` | Every model call with token counts, for cost per case |

## The `Fact` contract (`src/lib/types.ts`)

A fact has a `kind` (injury, treatment, deadline, task, coverage, case_value, expense, medical_bill, client_contact, status_change, request_to_provider, key_event), a `title`, optional `detail`, `date`, `amount`, an `importance` of 1 to 5, `shareableByDefault`, and a `source` (`resource`, `clioId`, `quote`, optional `page`). `firstSeenAt` powers "what changed since".

Fact IDs are a hash of source, kind, title and date, so re-extracting a changed record keeps `firstSeenAt` for facts that did not change.

## Local data

`data/` holds the database and downloaded documents. It is git-ignored and may contain client data. Never commit it.
