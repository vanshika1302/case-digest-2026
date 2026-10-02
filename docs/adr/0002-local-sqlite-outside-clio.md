# 0002: Local SQLite holds all derived data

**Status:** accepted

Synced records, facts, extraction state and cost logs live in `data/case-digest.db` (better-sqlite3), outside Clio.

**Why:** Simple, no infrastructure, fast for a hackathon, and the content hashes make "digest once" and "what changed" cheap.

**Consequence:** Data is per machine. Teammates do not share synced cases. `data/` must stay out of git. A deployed multi-user version would need a real database and auth.
