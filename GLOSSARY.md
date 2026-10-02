# Glossary

- **Matter**: a case in Clio Manage. Chosen at runtime, never hardcoded.
- **Record / item**: one Clio object (note, communication, task, calendar entry, document, expense, relationship).
- **Sync**: pulling a matter's records from Clio into SQLite. Full or incremental.
- **Digest**: the assembled `MatterDigest` the UIs show: matter, contacts, facts, usage.
- **Extraction**: turning new or changed records into facts. "Digest once" means a record is extracted once per version.
- **Fact**: a structured statement about the case with a kind, importance and a citation.
- **Citation / source**: the record, verbatim quote, and page a fact came from.
- **Firm view**: the attorney-facing dashboard.
- **Provider view**: the filtered view for treating medical providers.
- **Shareable / shared**: whether a fact appears in the provider view. `shareableByDefault` is the starting value; the attorney's Share toggle overrides it.
- **Private kinds**: fact kinds never shared by default (case value, coverage, expense).
- **Provider**: a treating medical professional or facility related to the matter (`providerContactId`).
- **Specials**: medical bills and related economic damages.
- **Demo case**: fictional data at `/demo`. **Sample matter**: fictional matter seeded locally by `npm run seed`.
