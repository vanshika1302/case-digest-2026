import type { Fact, MatterDigest } from "@/lib/types";
import { fmtDate, usd, type View } from "./format";

export type Tile = { label: string; value: string; sub?: string };

// Models sometimes put the figure in the title instead of `amount`; show the fact's own wording rather than guess.
const factValue = (f?: Fact) => (!f ? "Unknown" : f.kind === "case_value" || f.amount === undefined ? f.title : usd(f.amount));

/** The headline numbers for each view. Pure function of the digest, so it is easy to change on its own. */
export function buildTiles(digest: MatterDigest, view: View, isShared: (f: Fact) => boolean): Tile[] {
  const { matter, facts } = digest;

  if (view === "provider") {
    const openRequests = facts.filter((f) => f.kind === "request_to_provider" && f.status !== "complete").length;
    return [
      { label: "Case status", value: matter.status ?? "Open", sub: matter.displayNumber },
      { label: "Open requests", value: String(openRequests), sub: "from the firm" },
      { label: "Shared facts", value: String(facts.filter(isShared).length), sub: "visible to providers" },
    ];
  }

  const nextDeadline = facts
    .filter((f) => f.kind === "deadline" && f.date && new Date(f.date) >= new Date())
    .sort((a, b) => a.date!.localeCompare(b.date!))[0];
  const bills = facts.filter((f) => f.kind === "medical_bill");
  const policy = facts.find((f) => f.kind === "coverage" && f.amount) ?? facts.find((f) => f.kind === "coverage");
  const valueFact = facts.find((f) => f.kind === "case_value");

  return [
    { label: "Next deadline", value: nextDeadline ? fmtDate(nextDeadline.date) : "None", sub: nextDeadline?.title },
    { label: "Medical specials", value: usd(bills.reduce((s, f) => s + (f.amount ?? 0), 0)), sub: `${bills.length} bills` },
    { label: "Policy limit", value: factValue(policy), sub: policy?.source.resource },
    { label: "Working value", value: factValue(valueFact), sub: valueFact?.source.resource },
  ];
}
