// Seeds a FICTIONAL matter into the local SQLite DB (no Clio needed), shaped like synced Clio records.
// Run: npm run seed   then open /matter/9000001 and click "Extract facts".
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const MATTER_ID = 9000001;
const dir = path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, "case-digest.db"));
db.pragma("journal_mode = WAL");

const tables = db.prepare("SELECT name FROM sqlite_master WHERE name = 'items'").get();
if (!tables) {
  console.error("Database not initialised yet. Start the app once (npm run dev, open the page), then re-run.");
  process.exit(1);
}

const now = new Date().toISOString();
const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");

const matter = {
  id: MATTER_ID, display_number: "SAMPLE-0001-PI", description: "Rivera v. Coastline Logistics (sample data)",
  status: "Open", open_date: "2026-03-04", client: { id: 9100, name: "Maria Rivera", type: "Person" },
  custom_field_values: [{ id: "1", field_name: "Date of loss", field_type: "date", value: "2026-02-27" }],
};
db.prepare(
  `INSERT INTO matters (clio_id, display_number, description, data, synced_at) VALUES (?, ?, ?, ?, ?)
   ON CONFLICT(clio_id) DO UPDATE SET data = excluded.data, synced_at = excluded.synced_at`,
).run(MATTER_ID, matter.display_number, matter.description, JSON.stringify(matter), now);

const items = {
  relationships: [
    { id: 9200, description: "Orthopedic surgeon", contact: { id: 9101, name: "Dr. Anil Kapoor", type: "Person" } },
    { id: 9201, description: "Physical therapy", contact: { id: 9102, name: "Bayview Physical Therapy", type: "Company" } },
    { id: 9202, description: "Defendant's insurance carrier", contact: { id: 9103, name: "Pacific Mutual Insurance", type: "Company" } },
  ],
  notes: [
    { id: 9301, subject: "Intake call", date: "2026-03-04", detail: "Client Maria Rivera was rear-ended on I-5 southbound on 2/27/2026 while stopped in traffic. Other driver admitted fault at the scene. Client reports neck pain radiating into the right arm and numbness in two fingers. Went to Scripps ER same day, released with a muscle relaxant. Retained us 3/4." },
    { id: 9302, subject: "Treatment update", date: "2026-04-10", detail: "Client attending PT at Bayview twice weekly. Pain 7/10 down to 5/10 but arm tingling persists. Dr. Kapoor ordered MRI. Client missed 6 days of work; employer is holding her position." },
    { id: 9303, subject: "Attorney case evaluation", date: "2026-06-12", detail: "Specials approx. $60k including projected injections. Working settlement range 180-320k pending surgical opinion. Statute of limitations is 2/27/2028 (two years). Do not send a demand until Dr. Kapoor's narrative report is in. Keep valuation internal; do not share with providers." },
  ],
  communications: [
    { id: 9401, subject: "Policy limits", date: "2026-04-02", type: "EmailCommunication", body: "Per our records, our insured's bodily injury liability limit is $100,000 per person / $300,000 per accident. Claim number PM-88213. - J. Whitaker, Pacific Mutual", senders: [{ id: 9103, name: "Pacific Mutual Insurance" }], receivers: [] },
    { id: 9402, subject: "MRI results and treatment plan", date: "2026-05-28", type: "EmailCommunication", body: "MRI shows a C5-C6 posterior disc herniation with moderate foraminal narrowing. Recommend a C6-7 epidural steroid injection if PT does not reduce radicular symptoms by mid-June. Please send authorization for the procedure. - Dr. Kapoor", senders: [{ id: 9101, name: "Dr. Anil Kapoor" }], receivers: [] },
    { id: 9403, subject: "Bayview PT billing statement", date: "2026-06-30", type: "EmailCommunication", body: "Total charges through 6/30: $8,420.00 for 24 visits. Balance due: $8,420.00. We are holding on a lien basis. Please advise on case status when you can.", senders: [{ id: 9102, name: "Bayview Physical Therapy" }], receivers: [] },
  ],
  tasks: [
    { id: 9501, name: "Obtain updated narrative report re causation and future care from Dr. Kapoor", description: "Needed before demand", status: "pending", priority: "High", due_at: "2026-07-15", assignee: { id: 1, name: "D. Chen (paralegal)" } },
    { id: 9502, name: "Draft and send policy-limits demand to Pacific Mutual", description: "After narrative report", status: "pending", priority: "High", due_at: "2026-08-01", assignee: { id: 2, name: "S. Okafor (attorney)" } },
    { id: 9503, name: "Request Scripps ER records", status: "complete", priority: "Normal", due_at: "2026-03-20", completed_at: "2026-03-18", assignee: { id: 1, name: "D. Chen (paralegal)" } },
  ],
  expenses: [
    { id: 9601, type: "ExpenseEntry", date: "2026-05-02", quantity: 1, price: 96.5, total: 96.5, note: "Records retrieval fee, Bayview PT", expense_category: { id: 1, name: "Records" } },
    { id: 9602, type: "ExpenseEntry", date: "2026-03-20", quantity: 1, price: 42.0, total: 42.0, note: "Scripps ER records copying", expense_category: { id: 1, name: "Records" } },
  ],
  calendar_entries: [
    { id: 9701, summary: "Dr. Kapoor follow-up appointment (client)", description: "Review PT progress, discuss injection", start_at: "2026-06-18T09:00:00Z", end_at: "2026-06-18T10:00:00Z", all_day: false },
  ],
};

const upsert = db.prepare(
  `INSERT INTO items (resource, clio_id, matter_id, updated_at, data, content_hash, first_seen_at, last_changed_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(resource, clio_id) DO UPDATE SET data = excluded.data, content_hash = excluded.content_hash, last_changed_at = excluded.last_changed_at`,
);
let n = 0;
for (const [resource, records] of Object.entries(items)) {
  for (const r of records) {
    const rec = { ...r, updated_at: now };
    upsert.run(resource, r.id, MATTER_ID, now, JSON.stringify(rec), hash(rec), now, now);
    n++;
  }
}
// A fictional two-page medical bill, so the document (PDF) path can be tested without Clio.
async function makeBillPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = (lines) => {
    const p = pdf.addPage([612, 792]);
    let y = 740;
    for (const [text, b] of lines) {
      p.drawText(text, { x: 56, y, size: b ? 14 : 11, font: b ? bold : font, color: rgb(0, 0, 0) });
      y -= b ? 26 : 18;
    }
  };
  page([
    ["BAYVIEW PHYSICAL THERAPY", true], ["1200 Harbor Drive, San Diego, CA 92101", false], ["", false],
    ["STATEMENT OF CHARGES", true], ["Patient: Maria Rivera     Account: BPT-55120     Date of injury: 02/27/2026", false], ["", false],
    ["Date       Service                                   Units   Charge", false],
    ["04/06/26   Physical therapy evaluation                 1     $320.00", false],
    ["04/08/26   Therapeutic exercise                        4     $480.00", false],
    ["04/13/26   Therapeutic exercise / manual therapy       4     $520.00", false],
    ["04/20/26   Therapeutic exercise / manual therapy       4     $520.00", false],
    ["Charges this page: $1,840.00", true],
  ]);
  page([
    ["BAYVIEW PHYSICAL THERAPY  (page 2)", true], ["", false],
    ["Visits 05/04/26 through 06/30/26 (20 visits)                 $6,580.00", false], ["", false],
    ["TOTAL CHARGES THROUGH 06/30/2026: $8,420.00", true],
    ["Payments received: $0.00", false],
    ["BALANCE DUE: $8,420.00", true], ["", false],
    ["Services rendered on a lien basis pending resolution of the patient's claim.", false],
    ["Provider notes: patient reports persistent right arm tingling; recommends", false],
    ["continued therapy 2x/week and orthopedic follow-up with Dr. Kapoor.", false],
  ]);
  return Buffer.from(await pdf.save());
}

const DOC_ID = 9801;
const docDir = path.join(dir, "documents", String(MATTER_ID));
fs.mkdirSync(docDir, { recursive: true });
const docPath = path.join(docDir, `${DOC_ID}-Bayview-PT-statement.pdf`);
fs.writeFileSync(docPath, await makeBillPdf());
const docRec = { id: DOC_ID, name: "Bayview-PT-statement.pdf", content_type: "application/pdf", updated_at: now, latest_document_version: { id: 1, content_type: "application/pdf" } };
upsert.run("documents", DOC_ID, MATTER_ID, now, JSON.stringify(docRec), hash(docRec), now, now);
db.prepare(
  `INSERT INTO document_files (document_id, matter_id, version_id, path, content_type, downloaded_at) VALUES (?, ?, 1, ?, 'application/pdf', ?)
   ON CONFLICT(document_id) DO UPDATE SET path = excluded.path`,
).run(DOC_ID, MATTER_ID, docPath, now);
n++;

console.log(`Seeded fictional matter ${MATTER_ID} with ${n} records. Open http://127.0.0.1:3000/matter/${MATTER_ID} and click "Extract facts".`);
