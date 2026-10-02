# 0003: Every fact carries a citation

**Status:** accepted

A fact must store its source resource and id, a verbatim quote, and for documents the page in the original file.

**Why:** Attorneys will not trust a summary they cannot check. The Source drawer opens the quote, the full record and the document page.

**Consequence:** The model must return a quote for every fact (enforced by the tool schema). Long PDFs are chunked with page offsets so pages stay correct.
