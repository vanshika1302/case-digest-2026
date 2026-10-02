"use client";

import { useEffect, useState } from "react";
import type { Fact } from "@/lib/types";

export default function SourceDrawer({ fact, demo, onClose }: { fact: Fact; demo?: boolean; onClose: () => void }) {
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
