import type { Fact } from "@/lib/types";
import { dots, fmtDate, usd, type View } from "./format";

type Props = {
  fact: Fact;
  view: View;
  shared: boolean;
  isNew: boolean;
  onToggleShare: () => void;
  onOpen: () => void;
};

export default function FactCard({ fact, view, shared, isNew, onToggleShare, onOpen }: Props) {
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
