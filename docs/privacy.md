# Privacy and provider sharing

Treating providers should see where the case stands without the attorney handing over the file.

## Rules

1. The provider view shows only facts that are **shared**. A fact is shared if `shareableByDefault` is true and the attorney has not unchecked **Share**. The attorney can also opt a fact in.
2. The model proposes `shareableByDefault`, but `src/lib/digest.ts` forces it to false for the kinds in `PRIVATE_KINDS`: `case_value`, `coverage`, `expense`, `deadline` (limitation dates and court dates are firm-internal). This was added after a test where the model marked a policy limit as shareable, against the attorney's own note.
3. Provider view can be narrowed to one provider via `providerContactId`.

## Caveats

- Existing dashboard toggles remain session-only until wired to the visibility API. The API persists decisions and update timestamps locally, without a full audit history.
- New provider endpoints filter on the server. The existing dashboard still filters the firm digest locally. Authenticated provider roles and matter authorization are still required before exposing the app.
- Client data lives in `data/` on the machine running the app. Treat that folder as confidential.
- Document and note text is sent to the configured model provider (Anthropic, or OpenRouter if configured) for extraction.

## Network exposure

The dev and start scripts bind to `127.0.0.1` only (`next dev -H 127.0.0.1`), because the API has no login and returns client data. Do not change this to `0.0.0.0`, and do not expose the port (tunnels, shared wifi, port forwarding) while real case data is synced. Documents are served inline only for PDFs and common images; other types download.

## Server-side sharing API

fact_visibility stores fact_id, nullable provider_contact_id, shared (0/1), and updated_at, with unique global and provider-specific rows. Provider overrides win over global overrides, then existing defaults apply. Deletion restores the fallback. Overrides survive stable-ID fact re-extraction. case_value and expense always remain firm-only. Coverage and deadlines are private by default but may be explicitly shared. Scoped responses exclude facts attributed to another provider.

- GET /api/matters/:id/provider-facts?providerContactId=123&since=ISO returns filtered facts with minimal matter identity/status, without custom fields, contacts, photos or model usage.
- PUT /api/facts/:id/visibility accepts {"shared":true,"providerContactId":123}; omit providerContactId for a global override.
- DELETE /api/facts/:id/visibility?providerContactId=123 removes the scoped override; omit providerContactId to remove the global override.
- GET /api/matters/:id/provider-source/:factId?providerContactId=123 returns only approved fact title/detail/date/source, never the raw source or document download URL. Hidden facts and matter mismatches return 404.

Omitting providerContactId uses global visibility, not individual provider overrides. providerContactId is a filter, not authentication. Existing firm APIs and frontend contracts are unchanged. Keep the loopback-only binding until authenticated role and matter access are implemented. No sharing operation writes to Clio.

Run node tests/provider-sharing.cjs for isolated real SQLite and route regression checks.
