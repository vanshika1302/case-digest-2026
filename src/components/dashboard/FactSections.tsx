import type { Fact } from "@/lib/types";
import FactCard from "./FactCard";
import { FIRM_ORDER, KIND_LABEL, PROVIDER_ORDER, type View } from "./format";

type Props = {
  facts: Fact[];
  view: View;
  isShared: (f: Fact) => boolean;
  isNew: boolean;
  onToggleShare: (f: Fact) => void;
  onOpen: (f: Fact) => void;
};

export default function FactSections({ facts, view, isShared, isNew, onToggleShare, onOpen }: Props) {
  const order = view === "firm" ? FIRM_ORDER : PROVIDER_ORDER;

  return (
    <div className="mt-6 space-y-6">
      {order.map((kind) => {
        const items = facts.filter((f) => f.kind === kind).sort((a, b) => b.importance - a.importance);
        if (!items.length) return null;

        return (
          <section key={kind} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-600">{KIND_LABEL[kind]}</h2>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500">{items.length}</span>
            </div>
            <ul className="space-y-3">
              {items.map((f) => (
                <FactCard
                  key={f.id}
                  fact={f}
                  view={view}
                  shared={isShared(f)}
                  isNew={isNew}
                  onToggleShare={() => onToggleShare(f)}
                  onOpen={() => onOpen(f)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
