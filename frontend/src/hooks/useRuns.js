import { useCallback, useRef, useState } from "react";

export const MAX_RUNS = 12;
export const RUN_COLORS = [
  "#4fb3d9", "#e0a33e", "#7bc47f", "#c792ea", "#e5604d", "#5ccfcf", "#f2c94c", "#9aa5b1",
];

/** History of simulation runs, so several can be compared on the same charts. */
export function useRuns() {
  const [runs, setRuns] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const counter = useRef(0);

  const add = useCallback(({ system, type, params, result, tuned = false }) => {
    counter.current += 1;
    const id = counter.current;
    const series = result.time_points.map((t, i) => ({
      t, y: result.trajectory[i], u: result.control_signals[i],
    }));
    const run = { id, color: RUN_COLORS[(id - 1) % RUN_COLORS.length], visible: true,
                  system, type, params, result, tuned, series };
    setRuns((prev) => [...prev, run].slice(-MAX_RUNS));
    setActiveId(id);
  }, []);

  const toggle = useCallback(
    (id) => setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r))), []);
  const remove = useCallback((id) => setRuns((prev) => prev.filter((r) => r.id !== id)), []);
  const clear = useCallback(() => setRuns([]), []);

  const active = runs.find((r) => r.id === activeId) ?? runs.at(-1) ?? null;
  return { runs, active, add, toggle, remove, clear, select: setActiveId };
}
