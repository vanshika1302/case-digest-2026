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

/** Facts grouped by kind, in the order that suits the audience, most important first. */
export default function FactSections({ facts, view, isShared, isNew, onToggleShare, onOpen }: Props) {
  const order = view === "firm" ? FIRM_ORDER : PROVIDER_ORDER;
  return (
    <>
      {order.map((kind) => {
        const items = facts.filter((f) => f.kind === kind).sort((a, b) => b.importance - a.importance);
        if (!items.length) return null;
        return (
          <section key={kind} className="mt-7">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">{KIND_LABEL[kind]} <span className="font-normal">({items.length})</span></h2>
            <ul className="space-y-2">
              {items.map((f) => (
                <FactCard key={f.id} fact={f} view={view} shared={isShared(f)} isNew={isNew} onToggleShare={() => onToggleShare(f)} onOpen={() => onOpen(f)} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
