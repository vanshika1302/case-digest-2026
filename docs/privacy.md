# Privacy and provider sharing

Treating providers should see where the case stands without the attorney handing over the file.

## Rules

1. The provider view shows only facts that are **shared**. A fact is shared if `shareableByDefault` is true and the attorney has not unchecked **Share**. The attorney can also opt a fact in.
2. The model proposes `shareableByDefault`, but `src/lib/digest.ts` forces it to false for the kinds in `PRIVATE_KINDS`: `case_value`, `coverage`, `expense`, `deadline` (limitation dates and court dates are firm-internal). This was added after a test where the model marked a policy limit as shareable, against the attorney's own note.
3. Provider view can be narrowed to one provider via `providerContactId`.

## Caveats

- Share toggles currently live in the browser session only. They are not saved and not audited.
- The provider view is a filter in the same app, not a separate login. Real provider access would need authentication and server-side enforcement, since the digest API returns all facts.
- Client data lives in `data/` on the machine running the app. Treat that folder as confidential.
- Document and note text is sent to the configured model provider (Anthropic, or OpenRouter if configured) for extraction.

## Network exposure

The dev and start scripts bind to `127.0.0.1` only (`next dev -H 127.0.0.1`), because the API has no login and returns client data. Do not change this to `0.0.0.0`, and do not expose the port (tunnels, shared wifi, port forwarding) while real case data is synced. Documents are served inline only for PDFs and common images; other types download.
