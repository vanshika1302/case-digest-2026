# 0004: Provider privacy is enforced in code, not by the model

**Status:** accepted

The model proposes whether a fact is shareable, but `PRIVATE_KINDS` (case value, coverage, expenses, deadlines) are always private by default.

**Why:** In testing, the model marked a policy limit as shareable even though the attorney note said to keep valuation internal. A privacy rule cannot depend on model judgment.

**Consequence:** Facts the model wrongly marks private stay private unless the attorney opts them in, which is the safe direction. See `docs/privacy.md` for what is still unenforced (auth, persistence, audit).
