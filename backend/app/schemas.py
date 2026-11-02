"""Pydantic models: request validation and response shapes for the REST API."""
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

ControllerType = Literal["P", "PI", "PD", "PID", "FSF"]

MAX_STEPS = 50_000  # keeps one request from tying up the server


class UploadResponse(BaseModel):
    system_id: str
    name: str
    num_states: int


class ParamRange(BaseModel):
    min: float
    max: float


class SystemConfig(BaseModel):
    """Simulation settings. Every field is optional; defaults match the engine."""

    dt: float = Field(0.01, ge=0.001, le=1.0, description="Integration step (s)")
    max_time: float = Field(5.0, gt=0, le=60.0, description="Simulated duration (s)")
    target: float = Field(0.0, description="Setpoint for the output channel")
    min_control: float = -10.0
    max_control: float = 10.0
    initial_state: Optional[list[float]] = Field(
        None,
        description="One value per state. Default: output state = 1.0, the rest 0.",
    )

    @model_validator(mode="after")
    def _check_consistency(self) -> "SystemConfig":
        if self.min_control >= self.max_control:
            raise ValueError("min_control must be smaller than max_control")
        if self.max_time / self.dt > MAX_STEPS:
            raise ValueError(
                f"max_time / dt must be at most {MAX_STEPS} steps; increase dt or reduce max_time"
            )
        return self


class SimulationRequest(BaseModel):
    controller_type: ControllerType
    params: dict[str, float]
    system_config: SystemConfig = Field(default_factory=SystemConfig)


class Metrics(BaseModel):
    """Values the engine cannot express in JSON (inf / NaN) are returned as null."""

    mse: Optional[float]
    rmse: Optional[float]
    settling_time: Optional[float]
    rise_time: Optional[float]
    overshoot: Optional[float]
    ss_error: Optional[float]
    control_effort: Optional[float]
    zero_crossings: int
    stable: bool


class SimulationResponse(BaseModel):
    success: bool
    diverged: bool = Field(
        False, description="True if the response blew up and the series were cut short"
    )
    time_points: list[float]
    trajectory: list[float]
    control_signals: list[float]
    metrics: Metrics


class AutotuneRequest(BaseModel):
    controller_type: ControllerType
    system_config: SystemConfig = Field(default_factory=SystemConfig)


class AutotuneResponse(BaseModel):
    params: dict[str, float]
    cost: float
    evaluations: int
    result: SimulationResponse
