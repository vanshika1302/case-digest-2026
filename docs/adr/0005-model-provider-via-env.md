# 0005: Model provider and models are configured by env

**Status:** accepted

The Anthropic SDK reads `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL`; models come from `TEXT_MODEL` and `DOC_MODEL`. A fast model handles text, a stronger one handles documents.

**Why:** Teammates can use Anthropic directly or OpenRouter without code changes, and cost and quality can be tuned per record type.

**Consequence:** Shell-exported variables override `.env.local`. See `docs/running-locally.md`.
