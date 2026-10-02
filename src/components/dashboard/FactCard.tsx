import type { Fact } from "@/lib/types";
import { dots, fmtDate, usd, KIND_LABEL, type View } from "./format";

type Props = {
  fact: Fact;
  view: View;
  shared: boolean;
  isNew: boolean;
  onToggleShare: () => void;
  onOpen: () => void;
};

export default function FactCard({ fact, view, shared, isNew, onToggleShare, onOpen }: Props) {
  const pageLabel = fact.source.page ? `p.${fact.source.page}` : "source";

  return (
    <li className={`rounded-xl border p-3 ${fact.importance >= 4 ? "border-neutral-300 bg-neutral-50" : "border-neutral-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
              {KIND_LABEL[fact.kind]}
            </span>
            {isNew && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                New
              </span>
            )}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-neutral-900">{fact.title}</h3>
          {fact.detail && <p className="mt-1 text-sm leading-6 text-neutral-600">{fact.detail}</p>}

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
            {fact.date && <span>{fmtDate(fact.date)}</span>}
            {fact.amount !== undefined && <span className="font-medium text-neutral-700">{usd(fact.amount)}</span>}
            {fact.status && <span className="capitalize">{fact.status}</span>}
            {fact.assignee && <span>{fact.assignee}</span>}
            {view === "firm" && <span title={`Importance ${fact.importance}/5`} className="tracking-tighter text-amber-600">{dots(fact.importance)}</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button onClick={onOpen} className="rounded border border-neutral-200 bg-white px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-700 hover:bg-neutral-100">
            {pageLabel}
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-100 pt-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${shared ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"}`}>
            {shared ? "Shared with provider" : "Firm only"}
          </span>
          {fact.providerContactId && <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">Provider</span>}
        </div>

        {view === "firm" && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            <input type="checkbox" checked={shared} onChange={onToggleShare} className="h-3.5 w-3.5" />
            Share
          </label>
        )}
      </div>
    </li>
  );
}
