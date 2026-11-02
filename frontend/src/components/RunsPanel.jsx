import { downloadCsv } from "../csv";
import { formatGains } from "../utils";

export default function RunsPanel({ runs, activeId, onToggle, onSelect, onRemove, onClear }) {
  if (runs.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Runs <span className="font-normal text-ink/60">(tick to overlay on the charts)</span></h2>
        <button type="button" onClick={onClear} className="text-sm text-ink/60 hover:text-ink">Clear all</button>
      </div>
      <ul className="divide-y divide-ink/15 rounded-md border border-ink/15 bg-panel">
        {runs.map((run) => (
          <li key={run.id} className={`flex items-center gap-3 px-3 py-2 ${run.id === activeId ? "bg-ink/5" : ""}`}>
            <input type="checkbox" checked={run.visible} onChange={() => onToggle(run.id)}
              aria-label={`Show run ${run.id}`} style={{ accentColor: run.color }} />
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: run.color }} />
            <button type="button" onClick={() => onSelect(run.id)} className="min-w-0 flex-1 truncate text-left text-sm">
              <span className="font-medium">#{run.id} {run.system} · {run.type}</span>
              <span className="ml-2 font-mono text-xs text-ink/65">{formatGains(run.params)}</span>
              {run.tuned && <span className="ml-2 text-xs text-drive">auto-tuned</span>}
            </button>
            <span className={`text-xs ${run.result.metrics.stable ? "text-good" : "text-bad"}`}>
              {run.result.metrics.stable ? "Stable" : "Unstable"}
            </span>
            <button type="button" onClick={() => downloadCsv(run)} className="text-sm text-trace hover:underline">CSV</button>
            <button type="button" onClick={() => onRemove(run.id)} aria-label={`Remove run ${run.id}`}
              className="text-ink/50 hover:text-bad">×</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
