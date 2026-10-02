import type { MatterDigest } from "@/lib/types";
import type { View } from "./format";

type Props = {
  view: View;
  query: string;
  onQuery: (q: string) => void;
  since: string;
  onSince: (s: string) => void;
  providers: MatterDigest["contacts"];
  provider: number | "all";
  onProvider: (p: number | "all") => void;
};

export default function Filters({ view, query, onQuery, since, onSince, providers, provider, onProvider }: Props) {
  return (
    <>
      <section className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search facts and quotes…" className="min-w-52 flex-1 rounded border bg-transparent px-3 py-1.5" />
        {view === "provider" && (
          <select value={provider} onChange={(e) => onProvider(e.target.value === "all" ? "all" : Number(e.target.value))} className="rounded border bg-transparent px-2 py-1.5">
            <option value="all">All providers</option>
            {providers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-neutral-500">
          What changed since
          <input type="date" value={since} onChange={(e) => onSince(e.target.value)} className="rounded border bg-transparent px-2 py-1" />
          {since && <button onClick={() => onSince("")} className="underline">clear</button>}
        </label>
      </section>

      {view === "provider" && (
        <p className="mt-3 rounded bg-blue-50 p-2 text-xs text-blue-900 dark:bg-blue-950 dark:text-blue-200">
          Only facts the attorney has marked shareable appear here. Coverage, case value, and strategy stay private. Switch to Firm view to change what is shared.
        </p>
      )}
    </>
  );
}
