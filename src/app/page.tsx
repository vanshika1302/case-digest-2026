"use client";

import { useEffect, useState } from "react";

type Matter = { id: number; display_number?: string; description?: string; client?: { name?: string } };

// Landing page: connect Clio, pick a matter, sync it, open its dashboard.
export default function Home() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    fetch("/api/matters")
      .then((r) => r.json())
      .then((d) => {
        setConnected(d.connected);
        setMatters(d.matters ?? []);
        if (d.error) setError(d.error);
      })
      .catch((e) => setError(String(e)));
  }, []);

  async function extract(matterId: number) {
    setBusy(matterId);
    setResult(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/extract`, { method: "POST" });
      setResult(await res.json());
    } finally {
      setBusy(null);
    }
  }

  async function sync(matterId: number, full: boolean) {
    setBusy(matterId);
    setResult(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matterId, full }),
      });
      setResult(await res.json());
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8 font-sans">
      <h1 className="text-2xl font-semibold">Case Digest</h1>
      <a href="/demo" className="mt-2 inline-block text-sm underline">Explore the demo case (no keys needed)</a>

      {connected === null && <p className="mt-4">Checking Clio connection…</p>}
      {connected === false && (
        <a href="/api/auth/login" className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white">
          Connect Clio (read-only)
        </a>
      )}
      {error && <p className="mt-4 text-red-600">{error}</p>}

      {connected && (
        <ul className="mt-6 space-y-3">
          {matters.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{m.display_number}</div>
                <div className="text-sm text-gray-500">{m.description ?? m.client?.name}</div>
              </div>
              <div className="flex gap-2">
                <button disabled={busy !== null} onClick={() => sync(m.id, true)} className="rounded border px-3 py-1">
                  {busy === m.id ? "Syncing…" : "Full sync"}
                </button>
                <button disabled={busy !== null} onClick={() => sync(m.id, false)} className="rounded border px-3 py-1">
                  Incremental
                </button>
                <button disabled={busy !== null} onClick={() => extract(m.id)} className="rounded border px-3 py-1">
                  Extract facts
                </button>
                <a href={`/matter/${m.id}`} className="rounded bg-blue-600 px-3 py-1 text-white">
                  Open dashboard
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {result !== null && (
        <pre className="mt-6 overflow-x-auto rounded bg-gray-100 p-4 text-xs text-gray-900">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
