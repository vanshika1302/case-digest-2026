# Running locally

```bash
npm install
cp .env.example .env.local   # fill in your own keys
npm run dev
```

Open **http://127.0.0.1:3000** (not `localhost`; Clio only accepts 127.0.0.1 redirect URIs).

## No Clio data?

- `/demo` is a fictional case, no keys needed.
- `npm run seed` loads a fictional matter into your local database (start the app once first so the tables exist). It includes a fictional two-page PDF bill, so the document path is covered too. Open `/matter/9000001` and click **Extract facts**. This needs a model key.

## Env vars

See `.env.example`. Keys go only in `.env.local`, which is git-ignored. Never paste keys into chat, issues or PRs.

## OpenRouter instead of Anthropic

Leave `ANTHROPIC_API_KEY` empty and set `ANTHROPIC_BASE_URL=https://openrouter.ai/api`, `ANTHROPIC_AUTH_TOKEN`, and OpenRouter model IDs for `TEXT_MODEL` and `DOC_MODEL`.

## Gotchas

- Next.js does not override env vars already exported in your shell. If `ANTHROPIC_BASE_URL` or `ANTHROPIC_API_KEY` is set in your shell, it wins over `.env.local`. Symptom: 401 "invalid x-api-key". Check with `echo $ANTHROPIC_BASE_URL`, or start with `env -u ANTHROPIC_BASE_URL npm run dev`.
- No stray spaces after `=` in `.env.local`. A single space makes a variable non-empty.
- Restart `npm run dev` after editing `.env.local`.
- This is Next.js 16: read `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).
- `127.0.0.1` is listed in `allowedDevOrigins` in `next.config.ts` so the dev page hydrates.
