import type { Tile } from "./tiles";

export default function StatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <section className={`mt-6 grid gap-3 ${tiles.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"} grid-cols-2`}>
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="text-xs uppercase tracking-wide text-neutral-500">{t.label}</div>
          <div className={`mt-1 font-semibold ${t.value.length > 18 ? "text-sm leading-snug" : "text-xl"}`}>{t.value}</div>
          {t.sub && <div className="truncate text-xs text-neutral-500">{t.sub}</div>}
        </div>
      ))}
    </section>
  );
}
