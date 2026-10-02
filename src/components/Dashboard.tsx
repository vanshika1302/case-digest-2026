"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Fact, MatterDigest } from "@/lib/types";
import DashboardHeader from "./dashboard/DashboardHeader";
import DigestFooter from "./dashboard/DigestFooter";
import FactSections from "./dashboard/FactSections";
import Filters from "./dashboard/Filters";
import SourceDrawer from "./dashboard/SourceDrawer";
import StatTiles from "./dashboard/StatTiles";
import type { View } from "./dashboard/format";
import { buildTiles } from "./dashboard/tiles";

const money = (value?: number) => (typeof value === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : "—");
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—";
const getInitials = (name?: string) => (name ?? "Case").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "C";

const sortByImportance = (items: Fact[]) => [...items].sort((a, b) => b.importance - a.importance);
const sortByDate = (items: Fact[]) => [...items].sort((a, b) => new Date(b.date ?? b.firstSeenAt).getTime() - new Date(a.date ?? a.firstSeenAt).getTime());

const recentCutoff = () => Date.now() - 1000 * 60 * 60 * 24 * 30;

type Props = { digestUrl: string; matterId?: number; demo?: boolean };

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

  async function run(label: "sync" | "extract") {
    setBusy(label);
    try {
      const url = label === "sync" ? "/api/sync" : `/api/matters/${matterId}/extract`;
      const body = label === "sync" ? { matterId } : {};
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

  const summary = useMemo(() => {
    if (!digest) return null;
    const items = visible.length ? visible : digest.facts;
    const primaryInjury = sortByImportance(items.filter((f) => f.kind === "injury"))[0];
    const treatment = sortByImportance(items.filter((f) => f.kind === "treatment"))[0];
    const deadline = sortByDate(items.filter((f) => f.kind === "deadline" && f.date)).find((f) => new Date(f.date ?? 0).getTime() >= Date.now()) ?? sortByDate(items.filter((f) => f.kind === "deadline" && f.date))[0];
    const coverage = sortByImportance(items.filter((f) => f.kind === "coverage"))[0];
    const value = sortByImportance(items.filter((f) => f.kind === "case_value"))[0];
    const recent = sortByDate(items.filter((f) => f.firstSeenAt && new Date(f.firstSeenAt).getTime() >= recentCutoff())).slice(0, 3);
    const openRequests = items.filter((f) => f.kind === "request_to_provider" && f.status !== "complete").length;
    return { primaryInjury, treatment, deadline, coverage, value, recent, openRequests };
  }, [digest, visible]);

  const recentChanges = useMemo(() => {
    if (!digest) return [];
    const base = visible.length ? visible : digest.facts;
    return sortByDate(base.filter((f) => f.firstSeenAt && new Date(f.firstSeenAt).getTime() >= recentCutoff())).slice(0, 4);
  }, [digest, visible]);

  const digestStory = useMemo(() => {
    if (!digest || !summary) return "This case needs a summary.";
    const clientName = digest.matter.client?.name ?? "the client";
    const injury = summary.primaryInjury?.title ?? "an injury profile is still being developed";
    const treatment = summary.treatment?.title ?? "treatment remains active and needs updates";
    const coverage = summary.coverage?.title ?? "coverage details are still being confirmed";
    return `${clientName} is in an active ${digest.matter.status?.toLowerCase() ?? "open"} matter. The current case narrative centers on ${injury.toLowerCase()}. Treatment is currently ${treatment.toLowerCase()}, while ${coverage.toLowerCase()}. The team is focused on managing care, documentation, and the next deadline without losing visibility into recent developments.`;
  }, [digest, summary]);

  const nextDeadline = summary?.deadline ? `${summary.deadline.title} · ${formatDate(summary.deadline.date)}` : "No active deadline";
  const openTasks = visible.filter((f) => f.status && /pending|open|waiting/i.test(f.status)).length;

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-red-600">{error}</p>
        <Link href="/" className="mt-4 inline-block underline">Back to matters</Link>
      </main>
    );
  }

  if (!digest) return <main className="p-8">Loading digest…</main>;

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <DashboardHeader
          matter={digest.matter}
          view={view}
          onViewChange={setView}
          demo={demo}
          actions={!demo && matterId !== undefined && view === "firm" ? { busy, onRun: run } : undefined}
        />

        <StatTiles tiles={buildTiles(digest, view, isShared)} />

        <Filters
          view={view}
          query={query}
          onQuery={setQuery}
          since={since}
          onSince={setSince}
          providers={digest.contacts}
          provider={provider}
          onProvider={setProvider}
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_2.25fr_1.15fr]">
          <aside className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-lg font-semibold text-white">
                {getInitials(digest.matter.client?.name)}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Client snapshot</p>
                <h2 className="mt-1 text-lg font-semibold">{digest.matter.client?.name ?? "Client"}</h2>
              </div>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <dt className="text-neutral-500">Matter</dt>
                <dd className="font-medium">{digest.matter.displayNumber ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <dt className="text-neutral-500">Status</dt>
                <dd className="font-medium">{digest.matter.status ?? "Open"}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <dt className="text-neutral-500">Case age</dt>
                <dd className="font-medium">{digest.matter.openDate ? `${Math.max(1, Math.round((Date.now() - new Date(digest.matter.openDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))} mo` : "—"}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <dt className="text-neutral-500">Coverage</dt>
                <dd className="font-medium">{summary?.coverage?.title ?? "Not yet confirmed"}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <dt className="text-neutral-500">Working value</dt>
                <dd className="font-medium">{summary?.value ? money(summary.value.amount) : "—"}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                <dt className="text-neutral-500">Medical specials</dt>
                <dd className="font-medium">{money(visible.filter((f) => f.kind === "medical_bill").reduce((sum, fact) => sum + (fact.amount ?? 0), 0))}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-neutral-500">Firm expenses</dt>
                <dd className="font-medium">{money(visible.filter((f) => f.kind === "expense").reduce((sum, fact) => sum + (fact.amount ?? 0), 0))}</dd>
              </div>
            </dl>
          </aside>

          <section className="space-y-5">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">90-second digest</p>
                  <h2 className="mt-1 text-xl font-semibold">What matters right now</h2>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Active
                </span>
              </div>

              <p className="mt-4 text-[15px] leading-7 text-neutral-700">{digestStory}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Primary injury</p>
                  <p className="mt-2 text-sm font-medium text-neutral-900">{summary?.primaryInjury?.title ?? "No injury fact yet"}</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Current treatment</p>
                  <p className="mt-2 text-sm font-medium text-neutral-900">{summary?.treatment?.title ?? "No active treatment"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-600">Recent changes</h3>
                <span className="text-xs text-neutral-500">{since ? "Filtered" : "Last 30 days"}</span>
              </div>
              <div className="mt-3 space-y-2">
                {recentChanges.length ? recentChanges.map((fact) => (
                  <div key={fact.id} className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                    <span className="mt-0.5 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-emerald-500" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700">New</span>
                        <p className="text-sm font-medium text-neutral-900">{fact.title}</p>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{formatDate(fact.date ?? fact.firstSeenAt)} • {fact.source.resource}</p>
                    </div>
                  </div>
                )) : <p className="text-sm text-neutral-500">No recent changes in this view.</p>}
              </div>
            </div>

            <FactSections
              facts={visible}
              view={view}
              isShared={isShared}
              isNew={!!sinceIso}
              onToggleShare={(f) => setShareOverride((s) => ({ ...s, [f.id]: !isShared(f) }))}
              onOpen={setOpen}
            />
            {visible.length === 0 && (
              <p className="mt-8 text-sm text-neutral-500">No facts match. {digest.facts.length === 0 && !demo && "Run Sync, then Extract facts."}</p>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-600">Action / attention</h3>
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Next deadline</p>
                  <p className="mt-2 font-medium text-neutral-900">{nextDeadline}</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Waiting on</p>
                  <p className="mt-2 font-medium text-neutral-900">{summary?.openRequests ? `${summary.openRequests} provider request${summary.openRequests > 1 ? "s" : ""}` : "No pending requests"}</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Open tasks</p>
                  <p className="mt-2 font-medium text-neutral-900">{openTasks || "None"}</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Provider access</p>
                  <p className="mt-2 font-medium text-neutral-900">{view === "firm" ? "Review shared facts" : "View only shared facts"}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <DigestFooter digest={digest} />
      </div>

      {open && <SourceDrawer fact={open} demo={demo} onClose={() => setOpen(null)} />}
    </main>
  );
}
