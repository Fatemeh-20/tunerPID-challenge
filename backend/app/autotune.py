"""Gain search built only on the engine's own simulator and metrics.

Method (deliberately simple and deterministic):
  1. Random search: sample gains inside the schema ranges (biased to small values).
  2. Pattern search: from each of the best few samples, try a +/- step or switching off each
     gain, keep improvements and halve the step when nothing improves.

The score only combines the engine's own outputs, so no physics or
metric code is re-implemented here.
"""
import math
import random
from typing import Any

from src.core.simulator import Simulator

from .schemas import AutotuneRequest, AutotuneResponse
from .services import InvalidSimulationError, _default_initial_state, _to_response
from .store import StoredSystem

RANDOM_SAMPLES = 200
START_POINTS = 5  # best random samples that get refined
REFINE_ROUNDS = 12
UNSTABLE_PENALTY = 1000.0


def _finite(value: Any, fallback: float) -> float:
    if value is None:
        return fallback
    number = float(value)
    return number if math.isfinite(number) else fallback


def score(result: dict[str, Any], max_time: float, target: float) -> float:
    """Lower is better. Works on the engine's dict and on the API's JSON alike.

    Besides the engine's metrics it penalises (a) control effort, which rules out
    solutions that hold huge actuator values, and (b) the response first moving
    away from the target (peak error larger than the starting error).
    """
    metrics = result["metrics"]
    rmse = _finite(metrics["rmse"], 1e6)
    if not metrics["stable"]:
        return UNSTABLE_PENALTY + min(rmse, 1e6)

    settling = _finite(metrics["settling_time"], 2 * max_time)
    path = result["trajectory"]
    start = abs(path[0] - target) if path else 0.0
    peak = max((abs(y - target) for y in path), default=0.0)
    excursion = max(0.0, peak - start) / max(start, 1e-6)
    return (
        rmse + 0.05 * metrics["overshoot"] + 0.2 * settling
        + 2.0 * metrics["control_effort"] + excursion
    )


def _sample(rng: random.Random, bounds: dict[str, float]) -> float:
    # Squaring the draw favours small gains, where good controllers usually are.
    return bounds["min"] + (bounds["max"] - bounds["min"]) * rng.random() ** 2


def autotune(stored: StoredSystem, request: AutotuneRequest) -> AutotuneResponse:
    system = stored.system
    schema = system.get_param_schema(request.controller_type)
    if not schema:
        raise InvalidSimulationError("This controller type has no gains to tune")

    cfg = request.system_config
    initial = cfg.initial_state if cfg.initial_state is not None else _default_initial_state(system)
    if len(initial) != system.num_states:
        raise InvalidSimulationError(f"initial_state needs {system.num_states} values")

    rng = random.Random(0)  # fixed seed: same answer every time
    evaluations = 0

    def evaluate(params: dict[str, float]) -> tuple[float, dict[str, Any]]:
        nonlocal evaluations
        evaluations += 1
        raw = Simulator(system).evaluate(request.controller_type, params, initial)
        return score(raw, cfg.max_time, cfg.target), raw

    with stored.lock:  # settings live on the shared system object
        system.dt, system.max_time, system.target = cfg.dt, cfg.max_time, cfg.target
        system.min_control, system.max_control = cfg.min_control, cfg.max_control

        mid = {k: (r["min"] + r["max"]) / 2 for k, r in schema.items()}
        candidates = [(*evaluate(mid), mid)]
        for _ in range(RANDOM_SAMPLES):
            trial = {k: _sample(rng, r) for k, r in schema.items()}
            candidates.append((*evaluate(trial), trial))
        candidates.sort(key=lambda c: c[0])

        best_cost, best_raw, best = candidates[0]
        for start_cost, start_raw, start in candidates[:START_POINTS]:
            point, point_cost, point_raw = dict(start), start_cost, start_raw
            steps = {k: 0.2 * (r["max"] - r["min"]) for k, r in schema.items()}
            for _ in range(REFINE_ROUNDS):
                improved = False
                for key, bounds in schema.items():
                    # Moves: step up, step down, or switch the term off (jump to its minimum).
                    for target in (point[key] + steps[key], point[key] - steps[key], bounds["min"]):
                        trial = dict(point)
                        trial[key] = min(bounds["max"], max(bounds["min"], target))
                        trial_cost, trial_raw = evaluate(trial)
                        if trial_cost < point_cost:
                            point, point_cost, point_raw, improved = trial, trial_cost, trial_raw, True
                if not improved:
                    steps = {k: v / 2 for k, v in steps.items()}
            if point_cost < best_cost:
                best, best_cost, best_raw = point, point_cost, point_raw

    best = {k: round(v, 3) for k, v in best.items()}
    return AutotuneResponse(
        params=best, cost=best_cost, evaluations=evaluations, result=_to_response(best_raw)
    )
