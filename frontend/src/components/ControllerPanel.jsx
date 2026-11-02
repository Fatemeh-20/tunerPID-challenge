import { useEffect, useState } from "react";
import { parseNumber } from "../utils";

export const CONTROLLERS = ["P", "PI", "PD", "PID", "FSF"];

export function GainField({ name, range, value, onChange }) {
  const [text, setText] = useState(String(value));

  // Follow outside changes (slider, reset) without wiping a half-typed "1."
  useEffect(() => {
    if (parseNumber(text) !== value) setText(String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const typed = (raw) => {
    setText(raw);
    const n = parseNumber(raw);
    if (!Number.isNaN(n) && n >= range.min && n <= range.max) onChange(n);
  };

  const commit = () => {
    const n = parseNumber(text);
    if (Number.isNaN(n)) return setText(String(value));
    const clamped = Math.min(range.max, Math.max(range.min, n));
    onChange(clamped);
    setText(String(clamped));
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={`gain-${name}`} className="font-medium">{name}</label>
        <input
          id={`gain-${name}`}
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => typed(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="w-24 rounded border border-ink/25 bg-panel px-2 py-1 text-right font-mono text-sm tabular-nums"
        />
      </div>
      <input
        type="range"
        aria-label={`${name} slider`}
        min={range.min}
        max={range.max}
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-trace"
      />
      <div className="flex justify-between font-mono text-xs text-ink/55">
        <span>{range.min}</span>
        <span>{range.max}</span>
      </div>
    </div>
  );
}

function SettingField({ label, value, onChange, hint }) {
  const [text, setText] = useState(String(value));
  return (
    <label className="block text-sm">
      <span className="text-ink/70">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseNumber(e.target.value);
          if (!Number.isNaN(n) && n > 0) onChange(n);
        }}
        onBlur={() => setText(String(value))}
        className="mt-1 w-full rounded border border-ink/25 bg-panel px-2 py-1 text-right font-mono tabular-nums"
      />
      {hint && <span className="text-xs text-ink/50">{hint}</span>}
    </label>
  );
}

export default function ControllerPanel({
  type, onType, schema, params, onParam, onRun, onAutotune, onReset, busy, config, onConfig,
}) {
  const disabled = busy !== null || !schema;
  return (
    <section className="space-y-5">
      <div
        role="group"
        aria-label="Controller type"
        className="grid grid-cols-5 overflow-hidden rounded-md border border-ink/25 bg-panel"
      >
        {CONTROLLERS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === type}
            onClick={() => onType(c)}
            className={`py-2 text-sm font-medium ${c === type ? "bg-ink text-bench" : "hover:bg-bench"}`}
          >
            {c}
          </button>
        ))}
      </div>

      {schema &&
        Object.entries(schema).map(([name, range]) => (
          <GainField
            key={`${type}-${name}`}
            name={name}
            range={range}
            value={params[name] ?? range.min}
            onChange={(v) => onParam(name, v)}
          />
        ))}

      <div className="grid grid-cols-2 gap-3">
        <SettingField label="Step dt (s)" value={config.dt}
          onChange={(dt) => onConfig({ ...config, dt })} hint="DCMotor needs 0.001" />
        <SettingField label="Duration (s)" value={config.max_time}
          onChange={(max_time) => onConfig({ ...config, max_time })} />
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <button type="button" onClick={onRun} disabled={disabled}
            className="flex-1 rounded-md bg-trace px-4 py-2.5 font-medium text-bench hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
            {busy === "run" ? "Running…" : "Run simulation"}
          </button>
          <button type="button" onClick={onReset} disabled={disabled}
            className="rounded-md border border-ink/25 bg-panel px-3 py-2.5 text-sm hover:bg-bench disabled:opacity-50">
            Reset gains
          </button>
        </div>
        <button type="button" onClick={onAutotune} disabled={disabled}
          className="w-full rounded-md border border-drive/60 px-4 py-2 text-sm font-medium text-drive hover:bg-drive/10 disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "tune" ? "Searching for gains…" : "Auto-tune gains"}
        </button>
      </div>
    </section>
  );
}
