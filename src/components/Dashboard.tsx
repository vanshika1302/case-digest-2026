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

type Props = { digestUrl: string; matterId?: number; demo?: boolean };

/** Loads the digest, owns view/filter state, and composes the pieces in ./dashboard. */
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
    <main className="mx-auto max-w-5xl p-6">
      <DashboardHeader
        matter={digest.matter}
        view={view}
        onViewChange={setView}
        demo={demo}
        actions={!demo && matterId !== undefined && view === "firm" ? { busy, onRun: run } : undefined}
      />
      <StatTiles tiles={buildTiles(digest, view, isShared)} />
      <Filters
        view={view} query={query} onQuery={setQuery} since={since} onSince={setSince}
        providers={digest.contacts} provider={provider} onProvider={setProvider}
      />
      <FactSections
        facts={visible} view={view} isShared={isShared} isNew={!!sinceIso}
        onToggleShare={(f) => setShareOverride((s) => ({ ...s, [f.id]: !isShared(f) }))}
        onOpen={setOpen}
      />
      {visible.length === 0 && (
        <p className="mt-8 text-neutral-500">No facts match. {digest.facts.length === 0 && !demo && "Run Sync, then Extract facts."}</p>
      )}
      <DigestFooter digest={digest} />
      {open && <SourceDrawer fact={open} demo={demo} onClose={() => setOpen(null)} />}
    </main>
  );
}
