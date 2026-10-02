import type { FactKind } from "@/lib/types";

export type View = "firm" | "provider";

export const KIND_LABEL: Record<FactKind, string> = {
  injury: "Injuries", treatment: "Treatment", deadline: "Deadlines", task: "Tasks", coverage: "Coverage",
  case_value: "Case value", expense: "Expenses", medical_bill: "Medical bills", client_contact: "Client contact",
  status_change: "Status changes", request_to_provider: "Requests to providers", key_event: "Key events",
};
export const FIRM_ORDER: FactKind[] = ["deadline", "injury", "treatment", "request_to_provider", "task", "medical_bill", "coverage", "case_value", "key_event", "status_change", "client_contact", "expense"];
export const PROVIDER_ORDER: FactKind[] = ["request_to_provider", "treatment", "injury", "medical_bill", "key_event"];

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "");
export const dots = (n: number) => "●".repeat(n) + "○".repeat(5 - n);
