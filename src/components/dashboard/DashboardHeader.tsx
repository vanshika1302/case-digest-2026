import Link from "next/link";
import type { MatterDigest } from "@/lib/types";
import { fmtDate, type View } from "./format";

type Props = {
  matter: MatterDigest["matter"];
  view: View;
  onViewChange: (v: View) => void;
  demo?: boolean;
  actions?: { busy: string | null; onRun: (label: "sync" | "extract") => void };
};

export default function DashboardHeader({ matter, view, onViewChange, demo, actions }: Props) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-5">
      <div>
        <Link href="/" className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500 underline-offset-4 hover:underline">← All matters</Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">
          {view === "firm" ? matter.client?.name ?? matter.displayNumber ?? "Case Digest" : "Case status for treating providers"}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {matter.displayNumber} · {matter.description ?? "Open personal injury matter"}
          {matter.openDate && ` · opened ${fmtDate(matter.openDate)}`}
        </p>
        {demo && <p className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-800">Demo data</p>}
      </div>

      <div className="flex flex-col items-end gap-3">
        {view === "firm" && (
          <div className="flex flex-col items-end gap-1">
            <div className="inline-flex overflow-hidden rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
              <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Preview as</span>
              {(["firm", "provider"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => onViewChange(v)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === v ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100"}`}
                >
                  {v === "firm" ? "Firm" : "Provider"}
                </button>
              ))}
            </div>
            <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-400">Demo preview only · not a role switch</span>
          </div>
        )}

        {actions && (
          <div className="flex gap-2 text-xs">
            <button disabled={!!actions.busy} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => actions.onRun("sync")}>{actions.busy === "sync" ? "Syncing…" : "Sync"}</button>
            <button disabled={!!actions.busy} className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-medium text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => actions.onRun("extract")}>{actions.busy === "extract" ? "Extracting…" : "Extract facts"}</button>
          </div>
        )}
      </div>
    </header>
  );
}
