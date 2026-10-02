import type { Fact, MatterDigest } from "./types";

// Fictional sample case so the dashboard can be explored without Clio or Anthropic keys.
const now = new Date().toISOString();
const f = (
  n: number, kind: Fact["kind"], title: string, importance: Fact["importance"], shareable: boolean,
  source: Fact["source"], extra: Partial<Fact> = {},
): Fact => ({ id: `demo-${n}`, matterId: 0, kind, title, importance, shareableByDefault: shareable, source, firstSeenAt: now, ...extra });

export const demoDigest: MatterDigest = {
  matter: {
    id: 0, displayNumber: "2026-0142-PI", description: "Rivera v. Coastline Logistics: rear-end collision, I-5 S",
    status: "Open", openDate: "2026-03-04", client: { id: 1, name: "Maria Rivera" },
    customFields: [{ name: "Date of loss", value: "2026-02-27" }, { name: "Adjuster", value: "J. Whitaker, Pacific Mutual" }],
  },
  contacts: [
    { id: 11, name: "Dr. Anil Kapoor", role: "Orthopedic surgeon", type: "Person" },
    { id: 12, name: "Bayview Physical Therapy", role: "Physical therapy", type: "Company" },
    { id: 13, name: "Pacific Mutual Insurance", role: "Defendant's carrier", type: "Company" },
  ],
  facts: [
    f(1, "injury", "C5-C6 disc herniation with radiculopathy", 5, true, { resource: "documents", clioId: 901, quote: "MRI demonstrates a C5-C6 posterior disc herniation with moderate foraminal narrowing.", page: 3 }, { date: "2026-03-19", providerContactId: 11 }),
    f(2, "treatment", "Cervical epidural steroid injection recommended", 4, true, { resource: "communications", clioId: 702, quote: "Dr. Kapoor recommends a C6-7 ESI if PT does not reduce radicular symptoms by mid-June." }, { date: "2026-05-28", providerContactId: 11 }),
    f(3, "treatment", "Physical therapy 2x/week, 12 weeks", 3, true, { resource: "notes", clioId: 501, quote: "Client attending PT twice weekly at Bayview; pain 7/10 down to 5/10." }, { date: "2026-04-10", providerContactId: 12 }),
    f(4, "deadline", "Statute of limitations", 5, false, { resource: "matter", clioId: 1, quote: "Date of loss 2/27/2026; two-year limitations period (CCP 335.1)." }, { date: "2028-02-27" }),
    f(5, "coverage", "Defendant policy limit $100,000 per person", 4, false, { resource: "communications", clioId: 703, quote: "Our insured's bodily injury limit is $100,000 per person / $300,000 per accident." }, { amount: 100000, date: "2026-04-02" }),
    f(6, "medical_bill", "Bayview PT: outstanding balance", 3, true, { resource: "documents", clioId: 902, quote: "Total charges through 6/30: $8,420.00. Balance due: $8,420.00.", page: 1 }, { amount: 8420, date: "2026-06-30", providerContactId: 12 }),
    f(7, "medical_bill", "Kapoor Orthopedics: consult and MRI review", 3, true, { resource: "documents", clioId: 903, quote: "Consultation and imaging review: $1,150.00", page: 2 }, { amount: 1150, date: "2026-03-19", providerContactId: 11 }),
    f(8, "case_value", "Working settlement range $180k–$320k", 5, false, { resource: "notes", clioId: 502, quote: "Attorney eval: specials ~$60k incl. projected injections; range 180-320 pending surgical opinion." }, { amount: 250000, date: "2026-06-12" }),
    f(9, "request_to_provider", "Request: updated narrative report from Dr. Kapoor", 4, true, { resource: "tasks", clioId: 301, quote: "Obtain updated narrative report re causation and future care from Kapoor" }, { date: "2026-07-15", status: "pending", assignee: "Paralegal: D. Chen", providerContactId: 11 }),
    f(10, "task", "Send demand letter to Pacific Mutual", 4, false, { resource: "tasks", clioId: 302, quote: "Draft and send policy-limits demand once narrative report received" }, { date: "2026-08-01", status: "pending", assignee: "Attorney: S. Okafor" }),
    f(11, "expense", "Medical records fees", 1, false, { resource: "expenses", clioId: 401, quote: "Records retrieval, Bayview PT" }, { amount: 96.5, date: "2026-05-02" }),
    f(12, "key_event", "Collision on I-5 southbound", 4, true, { resource: "documents", clioId: 904, quote: "Unit 2 struck Unit 1 from behind while traffic was stopped.", page: 2 }, { date: "2026-02-27" }),
    f(13, "status_change", "Case moved to treatment-monitoring phase", 2, false, { resource: "notes", clioId: 503, quote: "Moving to treatment monitoring; no demand until MMI or surgical opinion." }, { date: "2026-05-01" }),
  ],
  lastExtractedAt: now,
  usage: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: null },
};
