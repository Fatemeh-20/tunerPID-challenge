"""Glue between the REST layer and the engine in src.core.

Rule: no physics or metrics are re-implemented here. We only load the
engine, pass settings in, and make the output safe to send as JSON.
"""
import math
import tempfile
import uuid
from pathlib import Path
from typing import Any

import numpy as np

from src.core.dynamics import DynamicalSystem
from src.core.simulator import Simulator

from .safety import UnsafeCodeError, check_source
from .schemas import Metrics, SimulationRequest, SimulationResponse
from .store import StoredSystem


class InvalidDynamicsError(ValueError):
    """The uploaded file is unsafe, broken, or not a valid dynamics file."""


class InvalidSimulationError(ValueError):
    """The simulation request is inconsistent with the loaded system."""


# --------------------------------------------------------------------------- #
#  Upload
# --------------------------------------------------------------------------- #
def load_system(filename: str, content: bytes) -> StoredSystem:
    try:
        source = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise InvalidDynamicsError("File must be UTF-8 text") from exc

    try:
        check_source(source)
    except UnsafeCodeError as exc:
        raise InvalidDynamicsError(str(exc)) from exc

    # The engine loads from a path, so write a temp file. Once loaded, the
    # dynamics function lives in memory and the file can be deleted.
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "dynamics.py"
        path.write_text(source, encoding="utf-8")
        try:
            system = DynamicalSystem(str(path))
        except (Exception, SystemExit) as exc:
            raise InvalidDynamicsError(f"Could not load dynamics: {exc}") from exc

    name = Path(filename).stem or "system"
    system.name = name
    return StoredSystem(system_id=uuid.uuid4().hex, name=name, system=system)


# --------------------------------------------------------------------------- #
#  Simulate
# --------------------------------------------------------------------------- #
def _validate_params(schema: dict[str, dict[str, float]], params: dict[str, float]) -> None:
    unknown = sorted(set(params) - set(schema))
    missing = sorted(set(schema) - set(params))
    if unknown or missing:
        raise InvalidSimulationError(
            f"params must be exactly {sorted(schema)} for this controller"
            + (f"; unknown: {unknown}" if unknown else "")
            + (f"; missing: {missing}" if missing else "")
        )
    for key, value in params.items():
        lo, hi = schema[key]["min"], schema[key]["max"]
        if not (lo <= value <= hi):
            raise InvalidSimulationError(f"{key}={value} is outside the allowed range [{lo}, {hi}]")


def _default_initial_state(system: DynamicalSystem) -> list[float]:
    # The engine would otherwise draw a random start, making runs irreproducible.
    state = np.zeros(system.num_states)
    state[system.output_channel] = 1.0
    return state.tolist()


def run_simulation(stored: StoredSystem, request: SimulationRequest) -> SimulationResponse:
    system = stored.system
    _validate_params(system.get_param_schema(request.controller_type), request.params)

    cfg = request.system_config
    initial = cfg.initial_state if cfg.initial_state is not None else _default_initial_state(system)
    if len(initial) != system.num_states:
        raise InvalidSimulationError(
            f"initial_state needs {system.num_states} values, got {len(initial)}"
        )

    with stored.lock:
        system.dt = cfg.dt
        system.max_time = cfg.max_time
        system.target = cfg.target
        system.min_control = cfg.min_control
        system.max_control = cfg.max_control
        raw = Simulator(system).evaluate(request.controller_type, request.params, initial)

    return _to_response(raw)


# --------------------------------------------------------------------------- #
#  Making engine output JSON-safe
# --------------------------------------------------------------------------- #
def _json_number(value: Any) -> Any:
    """inf / NaN cannot be sent as JSON; they become null."""
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    number = float(value)
    return number if math.isfinite(number) else None


def _to_response(raw: dict[str, Any]) -> SimulationResponse:
    t = np.asarray(raw["time_points"], dtype=float)
    y = np.asarray(raw["trajectory"], dtype=float)
    u = np.asarray(raw["control_signals"], dtype=float)

    # The engine's series can differ by one sample (float arange, early stop).
    n = min(len(t), len(y), len(u))
    t, y, u = t[:n], y[:n], u[:n]

    # Unstable gains can overflow to inf/NaN: keep the finite part and flag it.
    finite = np.isfinite(y) & np.isfinite(u)
    diverged = not bool(finite.all())
    if diverged:
        n = int(np.argmin(finite))
        t, y, u = t[:n], y[:n], u[:n]

    metrics = Metrics(**{key: _json_number(val) for key, val in raw["metrics"].items()})
    return SimulationResponse(
        success=bool(raw["success"]),
        diverged=diverged,
        time_points=t.tolist(),
        trajectory=y.tolist(),
        control_signals=u.tolist(),
        metrics=metrics,
    )
