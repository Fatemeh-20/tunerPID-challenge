import { useState } from "react";
import { autotune, getSchema, simulate, uploadSystem } from "./api";
import Charts from "./components/Charts";
import ControllerPanel from "./components/ControllerPanel";
import MetricsPanel from "./components/MetricsPanel";
import RunsPanel from "./components/RunsPanel";
import UploadBox from "./components/UploadBox";
import { useRuns } from "./hooks/useRuns";

// Same starting point as the Streamlit prototype: the middle of each range.
const defaultGains = (schema) =>
  Object.fromEntries(
    Object.entries(schema).map(([k, r]) => [k, Math.round(((r.min + r.max) / 2) * 100) / 100])
  );

export default function App() {
  const [system, setSystem] = useState(null);
  const [type, setType] = useState("PID");
  const [schema, setSchema] = useState(null);
  const [params, setParams] = useState({});
  const [config, setConfig] = useState({ dt: 0.01, max_time: 5 });
  const [busy, setBusy] = useState(null); // "upload" | "run" | "tune" | null
  const [error, setError] = useState("");
  const history = useRuns();

  async function loadSchema(id, controller) {
    const s = await getSchema(id, controller);
    setSchema(s);
    setParams(defaultGains(s));
  }

  async function guarded(kind, task) {
    setBusy(kind);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const onUpload = (file) =>
    guarded("upload", async () => {
      const sys = await uploadSystem(file);
      setSystem(sys);
      setType("PID");
      await loadSchema(sys.system_id, "PID");
    });

  const onType = (controller) => {
    setType(controller);
    guarded(null, () => loadSchema(system.system_id, controller));
  };

  const onRun = () =>
    guarded("run", async () => {
      const result = await simulate(system.system_id, {
        controller_type: type, params, system_config: config,
      });
      history.add({ system: system.name, type, params, result });
    });

  const onAutotune = () =>
    guarded("tune", async () => {
      const tuned = await autotune(system.system_id, { controller_type: type, system_config: config });
      setParams(tuned.params);
      history.add({ system: system.name, type, params: tuned.params, result: tuned.result, tuned: true });
    });

  const visible = history.runs.filter((r) => r.visible);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[22rem_1fr]">
      <aside className="space-y-6 border-b border-ink/15 bg-panel p-6 lg:border-b-0 lg:border-r">
        <h1 className="text-xl font-semibold">Controller Tuner</h1>
        <UploadBox system={system} onFile={onUpload} busy={busy === "upload"} />
        {system && (
          <ControllerPanel
            type={type} onType={onType} schema={schema} params={params}
            onParam={(name, value) => setParams((p) => ({ ...p, [name]: value }))}
            onRun={onRun} onAutotune={onAutotune}
            onReset={() => schema && setParams(defaultGains(schema))}
            busy={busy} config={config} onConfig={setConfig}
          />
        )}
        {error && (
          <p role="alert" className="rounded-md border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{error}</p>
        )}
      </aside>

      <main className="space-y-6 p-6">
        {history.active ? (
          <>
            <MetricsPanel metrics={history.active.result.metrics} diverged={history.active.result.diverged}
              title={`Metrics for run #${history.active.id}`} />
            <RunsPanel runs={history.runs} activeId={history.active.id} onToggle={history.toggle}
              onSelect={history.select} onRemove={history.remove} onClear={history.clear} />
            <Charts runs={visible} />
          </>
        ) : (
          <p className="max-w-prose pt-10 text-ink/70">
            {system
              ? "Pick a controller, set the gains, and choose Run simulation, or let Auto-tune find gains."
              : "Upload a dynamics file such as BallBeam.py to start tuning."}
          </p>
        )}
      </main>
    </div>
  );
}
