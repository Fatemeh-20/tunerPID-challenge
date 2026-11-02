const ROWS = [
  ["Settling time", "settling_time", " s"],
  ["Rise time", "rise_time", " s"],
  ["Overshoot", "overshoot", " %"],
  ["Steady-state error", "ss_error", ""],
  ["MSE", "mse", ""],
  ["RMSE", "rmse", ""],
  ["Control effort", "control_effort", ""],
  ["Zero crossings", "zero_crossings", ""],
];

// The backend sends null for values that are infinite or not a number.
function format(value, unit) {
  if (value === null || value === undefined) return "∞";
  const text = Number.isInteger(value) ? String(value) : Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(3);
  return text + unit;
}

export default function MetricsPanel({ metrics, diverged, title = "Metrics" }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-3">
        <h2 className="font-medium">{title}</h2>
        <span
          className={`rounded-full px-3 py-0.5 text-sm font-medium text-bench ${
            metrics.stable ? "bg-good" : "bg-bad"
          }`}
        >
          {metrics.stable ? "Stable" : "Unstable"}
        </span>
      </div>
      {diverged && (
        <p role="alert" className="mb-2 text-sm text-bad">
          The response diverged, so the charts stop where the values became infinite.
        </p>
      )}
      <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {ROWS.map(([label, key, unit]) => (
          <div key={key} className="flex justify-between border-b border-ink/15 py-2">
            <dt className="text-ink/70">{label}</dt>
            <dd className="font-mono tabular-nums">{format(metrics[key], unit)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
