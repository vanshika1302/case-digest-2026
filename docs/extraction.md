# Extraction

Code: `src/lib/extract.ts`, `src/lib/documents.ts`.

## Which model sees what

| Record type | How | Model env var |
|---|---|---|
| Notes, communications, calendar entries | AI, batched (15 records or about 40k characters per call) | `TEXT_MODEL` (fast) |
| Documents (PDF, images, .docx, text) | AI, one document at a time | `DOC_MODEL` (stronger) |
| Tasks, expenses | Deterministic mapping, no AI | none |

## Structured output

The model must call a `record_facts` tool with a fixed schema. That forces valid kinds, importance, and a verbatim quote for every fact. The system prompt forbids inventing dates, amounts, names or diagnoses.

## Documents and scans

PDFs go to Claude natively, so scanned pages are read visually with no separate OCR. Long PDFs are split into chunks of `PDF_PAGES_PER_CHUNK` pages. Each chunk records its page offset, so cited pages refer to the original file. Images over 5 MB are skipped; unsupported types are recorded as errors, not failures.

## Digest once

`extractions` stores the content hash of each record when it was extracted. Re-running extraction skips unchanged records. Changing a record in Clio and re-syncing re-extracts only that record.

## Cost

Every call is written to `llm_calls`. Set `MODEL_PRICES` (USD per million tokens) to see an estimated cost in the dashboard footer.

## Known limits

- The model sometimes puts a figure in a fact's `title` instead of `amount` (seen on policy limits). The UI falls back to the title.
- Facts the model marks `shareableByDefault` are overridden for private kinds. See [privacy.md](privacy.md).
