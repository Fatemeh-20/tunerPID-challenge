import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const AXIS = { fontSize: 12, fill: "#8a9bae" };

function Trace({ title, runs, dataKey, yLabel, target }) {
  const maxT = Math.max(0, ...runs.map((r) => r.series.at(-1)?.t ?? 0));
  return (
    <figure>
      <figcaption className="mb-1 font-medium">
        {title}
        {target !== undefined && <span className="ml-2 text-sm font-normal text-good">dashed line = target</span>}
      </figcaption>
      <div className="h-64 rounded-md border border-ink/15 bg-panel p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 8, right: 16, bottom: 16, left: 4 }}>
            <CartesianGrid stroke="#d9e2ec1f" />
            <XAxis dataKey="t" type="number" domain={[0, maxT]} tick={AXIS} stroke="#8a9bae"
              tickFormatter={(v) => v.toFixed(1)}
              label={{ value: "Time (s)", position: "insideBottom", offset: -8, ...AXIS }} />
            <YAxis tick={AXIS} stroke="#8a9bae" width={56} tickFormatter={(v) => +v.toPrecision(3)}
              label={{ value: yLabel, angle: -90, position: "insideLeft", ...AXIS }} />
            <Tooltip shared={false} formatter={(v) => (+v).toPrecision(4)}
              labelFormatter={(v) => `t = ${(+v).toFixed(2)} s`}
              contentStyle={{ background: "#151d27", border: "1px solid #2a3644", color: "#d9e2ec" }} />
            {target !== undefined && <ReferenceLine y={target} stroke="#4caf7d" strokeDasharray="6 4" />}
            {runs.map((run) => (
              <Line key={run.id} data={run.series} dataKey={dataKey} name={`#${run.id}`} type="monotone"
                stroke={run.color} strokeWidth={2} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export default function Charts({ runs, target = 0 }) {
  if (runs.length === 0) return <p className="text-ink/60">Tick at least one run to see its curves.</p>;
  return (
    <div className="space-y-5">
      <Trace title="System response" runs={runs} dataKey="y" yLabel="Output" target={target} />
      <Trace title="Control input" runs={runs} dataKey="u" yLabel="Control signal" />
    </div>
  );
}
