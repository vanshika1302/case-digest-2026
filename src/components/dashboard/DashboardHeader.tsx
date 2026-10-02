import Link from "next/link";
import type { MatterDigest } from "@/lib/types";
import { fmtDate, type View } from "./format";

type Props = {
  matter: MatterDigest["matter"];
  view: View;
  onViewChange: (v: View) => void;
  demo?: boolean;
  /** Present only for live matters in the firm view: shows Sync / Extract buttons. */
  actions?: { busy: string | null; onRun: (label: "sync" | "extract") => void };
};

export default function DashboardHeader({ matter, view, onViewChange, demo, actions }: Props) {
  return (
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
            <button key={v} onClick={() => onViewChange(v)} className={`px-4 py-1.5 text-sm ${view === v ? "bg-blue-600 text-white" : ""}`}>
              {v === "firm" ? "Firm view" : "Provider view"}
            </button>
          ))}
        </div>
        {actions && (
          <div className="flex gap-2 text-xs">
            <button disabled={!!actions.busy} className="rounded border px-2 py-1" onClick={() => actions.onRun("sync")}>{actions.busy === "sync" ? "Syncing…" : "Sync"}</button>
            <button disabled={!!actions.busy} className="rounded border px-2 py-1" onClick={() => actions.onRun("extract")}>{actions.busy === "extract" ? "Extracting…" : "Extract facts"}</button>
          </div>
        )}
      </div>
    </header>
  );
}
