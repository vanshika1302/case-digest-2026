# Contributing

## Setup

See [docs/running-locally.md](docs/running-locally.md). Short version: `npm install`, copy `.env.example` to `.env.local` and fill in **your own** keys, `npm run seed`, `npm run dev`, open `http://127.0.0.1:3000/demo`.

## Workflow

1. `git checkout main && git pull`
2. `git checkout -b <area>-<what>` (for example `ui-provider-polish`)
3. Make changes. Run `npx tsc --noEmit` and `npx eslint src` before pushing.
4. `git push -u origin <branch>` and open a pull request. `main` is protected: changes go through a PR.
5. Get one teammate to review, then merge. Pull `main` again before the next branch.

Keep PRs small and focused. Pull often, since several people are editing the UI.

## Ownership (to avoid conflicts)

Agree in the team chat who is working on which area before starting. Suggested split:

| Area | Files |
|---|---|
| Firm view | `src/components/` (firm parts), `src/app/matter/` |
| Provider view | `src/components/` (provider parts) |
| Pipeline (sync, extraction) | `src/lib/ingest.ts`, `extract.ts`, `documents.ts`, `resources.ts` |
| Docs and demo | `docs/`, `src/lib/demo.ts`, `README.md` |

`src/lib/types.ts` is the shared contract. Do not change it without telling everyone.

## Never commit

- `.env.local` or any file with keys. Do not paste keys into chat, issues or PRs. If you leak one, rotate it immediately.
- Anything in `data/`. It may contain client case data.
- Real client information in code, demo data, screenshots or PR text. Use the fictional sample only.

## Code notes

- Next.js here is a newer version with breaking changes. Read `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).
- Clio access must stay read-only ([ADR 0001](docs/adr/0001-read-only-clio-access.md)).
- Privacy rules live in code ([ADR 0004](docs/adr/0004-privacy-enforced-in-code.md)). Do not weaken them in the UI.
