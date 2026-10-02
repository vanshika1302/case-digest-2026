"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Fact, FactKind, MatterDigest } from "@/lib/types";

type Props = { digestUrl: string; matterId?: number; demo?: boolean };
type View = "firm" | "provider";

const KIND_LABEL: Record<FactKind, string> = {
  injury: "Injuries", treatment: "Treatment", deadline: "Deadlines", task: "Tasks", coverage: "Coverage",
  case_value: "Case value", expense: "Expenses", medical_bill: "Medical bills", client_contact: "Client contact",
  status_change: "Status changes", request_to_provider: "Requests to providers", key_event: "Key events",
};
const FIRM_ORDER: FactKind[] = ["deadline", "injury", "treatment", "request_to_provider", "task", "medical_bill", "coverage", "case_value", "key_event", "status_change", "client_contact", "expense"];
const PROVIDER_ORDER: FactKind[] = ["request_to_provider", "treatment", "injury", "medical_bill", "key_event"];

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "");
const dots = (n: number) => "●".repeat(n) + "○".repeat(5 - n);

function Source({ fact, demo, onClose }: { fact: Fact; demo?: boolean; onClose: () => void }) {
  const { resource, clioId, quote, page } = fact.source;
  const [record, setRecord] = useState<{ data?: Record<string, unknown>; fileUrl?: string } | null>(null);

  useEffect(() => {
    if (demo) return;
    fetch(`/api/source/${resource}/${clioId}`).then((r) => r.json()).then(setRecord).catch(() => setRecord(null));
  }, [demo, resource, clioId]);

  return (
    <aside className="fixed inset-y-0 right-0 z-20 w-full max-w-lg overflow-y-auto border-l border-neutral-300 bg-white p-6 text-neutral-900 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
      <button onClick={onClose} className="float-right rounded border px-2 py-1 text-sm">Close</button>
      <p className="text-xs uppercase tracking-wide text-neutral-500">Source · {resource} #{clioId}{page ? ` · page ${page}` : ""}</p>
      <h2 className="mt-1 text-lg font-semibold">{fact.title}</h2>
      <blockquote className="mt-4 border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-neutral-900 dark:bg-amber-950 dark:text-amber-100">“{quote}”</blockquote>
      {record?.fileUrl && (
        <iframe title="Source document" src={`${record.fileUrl}${page ? `#page=${page}` : ""}`} className="mt-4 h-[28rem] w-full rounded border" />
      )}
      {record?.data && (
        <details className="mt-4 text-sm" open={!record.fileUrl}>
          <summary className="cursor-pointer text-neutral-500">Full record from Clio</summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-neutral-100 p-3 text-xs text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">{JSON.stringify(record.data, null, 2)}</pre>
        </details>
      )}
      {demo && <p className="mt-4 text-xs text-neutral-500">Demo data: connect Clio to open the original record or document page.</p>}
    </aside>
  );
}

function FactCard({ fact, view, shared, onToggleShare, onOpen, isNew }: {
  fact: Fact; view: View; shared: boolean; onToggleShare: () => void; onOpen: () => void; isNew: boolean;
}) {
  return (
    <li className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">
            {fact.title}
            {isNew && <span className="ml-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">New</span>}
          </div>
          {fact.detail && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{fact.detail}</p>}
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
            {fact.date && <span>{fmtDate(fact.date)}</span>}
            {fact.amount !== undefined && <span className="font-medium text-neutral-700 dark:text-neutral-300">{usd(fact.amount)}</span>}
            {fact.status && <span className="capitalize">{fact.status}</span>}
            {fact.assignee && <span>{fact.assignee}</span>}
            {view === "firm" && <span title={`Importance ${fact.importance}/5`} className="tracking-tighter text-amber-600">{dots(fact.importance)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button onClick={onOpen} className="rounded border px-2 py-0.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Source{fact.source.page ? ` p.${fact.source.page}` : ""}
          </button>
          {view === "firm" && (
            <label className="flex cursor-pointer items-center gap-1 text-xs text-neutral-500">
              <input type="checkbox" checked={shared} onChange={onToggleShare} /> Share
            </label>
          )}
        </div>
      </div>
    </li>
  );
}

export default function Dashboard({ digestUrl, matterId, demo }: Props) {
  const [digest, setDigest] = useState<MatterDigest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("firm");
  const [open, setOpen] = useState<Fact | null>(null);
  const [provider, setProvider] = useState<number | "all">("all");
  const [shareOverride, setShareOverride] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [since, setSince] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(digestUrl)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed to load");
        setDigest(d);
        setError(null);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [digestUrl]);
  useEffect(load, [load]);

  async function run(label: string, url: string, body: unknown) {
    setBusy(label);
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      load();
    } finally {
      setBusy(null);
    }
  }

  const isShared = useCallback((f: Fact) => shareOverride[f.id] ?? f.shareableByDefault, [shareOverride]);
  const sinceIso = since ? new Date(since).toISOString() : "";

  const visible = useMemo(() => {
    if (!digest) return [];
    const q = query.trim().toLowerCase();
    return digest.facts.filter((f) => {
      if (view === "provider") {
        if (!isShared(f)) return false;
        if (provider !== "all" && f.providerContactId !== provider) return false;
      }
      if (sinceIso && f.firstSeenAt <= sinceIso) return false;
      if (q && !`${f.title} ${f.detail ?? ""} ${f.source.quote}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [digest, view, provider, isShared, query, sinceIso]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-red-600">{error}</p>
        <Link href="/" className="mt-4 inline-block underline">Back to matters</Link>
      </main>
    );
  }
  if (!digest) return <main className="p-8">Loading digest…</main>;

  const { matter } = digest;
  const facts = digest.facts;
  const nextDeadline = facts.filter((f) => f.kind === "deadline" && f.date && new Date(f.date) >= new Date()).sort((a, b) => a.date!.localeCompare(b.date!))[0];
  const billed = facts.filter((f) => f.kind === "medical_bill").reduce((s, f) => s + (f.amount ?? 0), 0);
  const policy = facts.find((f) => f.kind === "coverage" && f.amount) ?? facts.find((f) => f.kind === "coverage");
  const valueFact = facts.find((f) => f.kind === "case_value");
  // Models sometimes put the figure in the title instead of `amount`; show the fact's own wording rather than guess.
  const factValue = (f?: Fact) => (!f ? "Unknown" : f.kind === "case_value" || f.amount === undefined ? f.title : usd(f.amount));
  const openRequests = facts.filter((f) => f.kind === "request_to_provider" && f.status !== "complete").length;
  const order = view === "firm" ? FIRM_ORDER : PROVIDER_ORDER;
  const providers = digest.contacts;

  const tiles = view === "firm"
    ? [
        { label: "Next deadline", value: nextDeadline ? fmtDate(nextDeadline.date) : "None", sub: nextDeadline?.title },
        { label: "Medical specials", value: usd(billed), sub: `${facts.filter((f) => f.kind === "medical_bill").length} bills` },
        { label: "Policy limit", value: factValue(policy), sub: policy?.source.resource },
        { label: "Working value", value: factValue(valueFact), sub: valueFact?.source.resource },
      ]
    : [
        { label: "Case status", value: matter.status ?? "Open", sub: matter.displayNumber },
        { label: "Open requests", value: String(openRequests), sub: "from the firm" },
        { label: "Shared facts", value: String(facts.filter(isShared).length), sub: "visible to providers" },
      ];

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-xs text-neutral-500 underline">← All matters</Link>
          <h1 className="mt-1 text-2xl font-semibold">{view === "firm" ? matter.client?.name ?? matter.displayNumber : "Case status for treating providers"}</h1>
          <p className="text-sm text-neutral-500">
            {matter.displayNumber} · {matter.description} {matter.openDate && `· opened ${fmtDate(matter.openDate)}`}
          </p>
          {demo && <p className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Demo data (fictional case)</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border">
            {(["firm", "provider"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 text-sm ${view === v ? "bg-blue-600 text-white" : ""}`}>
                {v === "firm" ? "Firm view" : "Provider view"}
              </button>
            ))}
          </div>
          {!demo && matterId !== undefined && view === "firm" && (
            <div className="flex gap-2 text-xs">
              <button disabled={!!busy} className="rounded border px-2 py-1" onClick={() => run("sync", "/api/sync", { matterId })}>{busy === "sync" ? "Syncing…" : "Sync"}</button>
              <button disabled={!!busy} className="rounded border px-2 py-1" onClick={() => run("extract", `/api/matters/${matterId}/extract`, {})}>{busy === "extract" ? "Extracting…" : "Extract facts"}</button>
            </div>
          )}
        </div>
      </header>

      <section className={`mt-6 grid gap-3 ${tiles.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"} grid-cols-2`}>
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="text-xs uppercase tracking-wide text-neutral-500">{t.label}</div>
            <div className={`mt-1 font-semibold ${t.value.length > 18 ? "text-sm leading-snug" : "text-xl"}`}>{t.value}</div>
            {t.sub && <div className="truncate text-xs text-neutral-500">{t.sub}</div>}
          </div>
        ))}
      </section>

      <section className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search facts and quotes…" className="min-w-52 flex-1 rounded border bg-transparent px-3 py-1.5" />
        {view === "provider" && (
          <select value={provider} onChange={(e) => setProvider(e.target.value === "all" ? "all" : Number(e.target.value))} className="rounded border bg-transparent px-2 py-1.5">
            <option value="all">All providers</option>
            {providers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-neutral-500">
          What changed since
          <input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="rounded border bg-transparent px-2 py-1" />
          {since && <button onClick={() => setSince("")} className="underline">clear</button>}
        </label>
      </section>

      {view === "provider" && (
        <p className="mt-3 rounded bg-blue-50 p-2 text-xs text-blue-900 dark:bg-blue-950 dark:text-blue-200">
          Only facts the attorney has marked shareable appear here. Coverage, case value, and strategy stay private. Switch to Firm view to change what is shared.
        </p>
      )}

      {order.map((kind) => {
        const items = visible.filter((f) => f.kind === kind);
        if (!items.length) return null;
        return (
          <section key={kind} className="mt-7">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">{KIND_LABEL[kind]} <span className="font-normal">({items.length})</span></h2>
            <ul className="space-y-2">
              {items.sort((a, b) => b.importance - a.importance).map((f) => (
                <FactCard
                  key={f.id} fact={f} view={view} shared={isShared(f)} isNew={!!sinceIso}
                  onToggleShare={() => setShareOverride((s) => ({ ...s, [f.id]: !isShared(f) }))}
                  onOpen={() => setOpen(f)}
                />
              ))}
            </ul>
          </section>
        );
      })}
      {visible.length === 0 && <p className="mt-8 text-neutral-500">No facts match. {facts.length === 0 && !demo && "Run Sync, then Extract facts."}</p>}

      <footer className="mt-10 border-t pt-3 text-xs text-neutral-500">
        {digest.lastExtractedAt && <>Last extracted {new Date(digest.lastExtractedAt).toLocaleString()} · </>}
        {digest.usage.calls} model calls · {(digest.usage.inputTokens + digest.usage.outputTokens).toLocaleString()} tokens
        {digest.usage.estimatedUsd !== null && <> · ≈ ${digest.usage.estimatedUsd}</>}
      </footer>

      {open && <Source fact={open} demo={demo} onClose={() => setOpen(null)} />}
    </main>
  );
}
