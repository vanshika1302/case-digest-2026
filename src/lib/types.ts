// The shared contract between the pipeline and both UIs. Change only by team agreement.

export const FACT_KINDS = [
  "injury", "treatment", "deadline", "task", "coverage", "case_value",
  "expense", "medical_bill", "client_contact", "status_change",
  "request_to_provider", "key_event",
] as const;

export type FactKind = (typeof FACT_KINDS)[number];

export type FactSource = {
  resource: string;   // "notes" | "communications" | "documents" | "tasks" | "matter" | ...
  clioId: number;
  quote: string;      // verbatim snippet from the source that supports the fact
  page?: number;      // for documents: 1-based page in the original file
};

export type Fact = {
  id: string;                 // stable across re-extractions
  matterId: number;
  kind: FactKind;
  title: string;
  detail?: string;
  date?: string;              // ISO date or datetime
  amount?: number;            // dollars
  importance: 1 | 2 | 3 | 4 | 5;
  providerContactId?: number;
  shareableByDefault: boolean;
  status?: string;            // tasks: "pending" | "complete" | ...
  assignee?: string;          // tasks
  source: FactSource;
  firstSeenAt: string;        // when this fact first appeared: powers "what changed since"
};

export type MatterDigest = {
  matter: {
    id: number;
    displayNumber?: string;
    description?: string;
    status?: string;
    openDate?: string;
    client?: { id: number; name: string };
    customFields: { name: string; value: unknown }[];
  };
  contacts: { id: number; name: string; role?: string; type?: string }[];
  clientPhotoDocumentId?: number;
  facts: Fact[];
  lastExtractedAt?: string;
  usage: { calls: number; inputTokens: number; outputTokens: number; estimatedUsd: number | null };
};
