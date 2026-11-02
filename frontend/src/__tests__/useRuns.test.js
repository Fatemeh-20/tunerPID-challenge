import { act, renderHook } from "@testing-library/react";
import { MAX_RUNS, useRuns } from "../hooks/useRuns";

const result = { time_points: [0, 1], trajectory: [1, 0], control_signals: [0, 0], metrics: {} };
const sample = { system: "BallBeam", type: "PID", params: { Kp: 1 }, result };

describe("useRuns", () => {
  it("adds runs, makes the newest active and gives each its own colour", () => {
    const { result: hook } = renderHook(() => useRuns());
    act(() => { hook.current.add(sample); hook.current.add(sample); });
    expect(hook.current.runs).toHaveLength(2);
    expect(hook.current.active.id).toBe(2);
    expect(hook.current.runs[0].color).not.toBe(hook.current.runs[1].color);
  });

  it("toggles visibility and falls back to the last run when the active one is removed", () => {
    const { result: hook } = renderHook(() => useRuns());
    act(() => { hook.current.add(sample); hook.current.add(sample); });
    act(() => hook.current.toggle(1));
    expect(hook.current.runs[0].visible).toBe(false);
    act(() => hook.current.remove(2));
    expect(hook.current.active.id).toBe(1);
  });

  it("keeps only the most recent runs", () => {
    const { result: hook } = renderHook(() => useRuns());
    act(() => { for (let i = 0; i < MAX_RUNS + 3; i += 1) hook.current.add(sample); });
    expect(hook.current.runs).toHaveLength(MAX_RUNS);
    expect(hook.current.runs[0].id).toBe(4);
  });

  it("clears everything", () => {
    const { result: hook } = renderHook(() => useRuns());
    act(() => hook.current.add(sample));
    act(() => hook.current.clear());
    expect(hook.current.active).toBeNull();
  });
});
