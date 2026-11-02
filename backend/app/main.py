"""FastAPI entry point.  Run from the repo root:

    uvicorn backend.app.main:app --reload --port 8000
"""
import os
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import autotune, services
from .schemas import (
    AutotuneRequest,
    AutotuneResponse,
    ControllerType,
    ParamRange,
    SimulationRequest,
    SimulationResponse,
    UploadResponse,
)
from .store import StoredSystem, store

MAX_UPLOAD_BYTES = 100_000

app = FastAPI(
    title="Controller Tuner API",
    version="1.0.0",
    description="REST wrapper around the src.core simulation engine.",
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_system(system_id: str) -> StoredSystem:
    try:
        return store.get(system_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown system_id '{system_id}'") from None


@app.get("/api/v1/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/upload", response_model=UploadResponse, tags=["systems"])
def upload(file: Annotated[UploadFile, File(description="A .py file defining dynamics(t, x, u)")]):
    filename = file.filename or ""
    if not filename.lower().endswith(".py"):
        raise HTTPException(status_code=400, detail="Only .py files are accepted")

    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413, detail=f"File too large (limit {MAX_UPLOAD_BYTES // 1000} KB)"
        )
    if not content.strip():
        raise HTTPException(status_code=400, detail="File is empty")

    try:
        stored = services.load_system(filename, content)
    except services.InvalidDynamicsError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    store.add(stored)
    return UploadResponse(
        system_id=stored.system_id, name=stored.name, num_states=stored.system.num_states
    )


@app.get(
    "/api/v1/systems/{system_id}/schema",
    response_model=dict[str, ParamRange],
    tags=["systems"],
)
def get_schema(system_id: str, controller_type: ControllerType = Query("PID")):
    stored = _get_system(system_id)
    return stored.system.get_param_schema(controller_type)


@app.post(
    "/api/v1/systems/{system_id}/simulate",
    response_model=SimulationResponse,
    tags=["systems"],
)
def simulate(system_id: str, request: SimulationRequest):
    stored = _get_system(system_id)
    try:
        result = services.run_simulation(stored, request)
    except services.InvalidSimulationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not result.trajectory:
        raise HTTPException(
            status_code=422,
            detail="Simulation produced no data: dynamics() failed on the first step",
        )
    return result


@app.post(
    "/api/v1/systems/{system_id}/autotune",
    response_model=AutotuneResponse,
    tags=["systems"],
)
def run_autotune(system_id: str, request: AutotuneRequest):
    """Search the gain ranges for the best controller (see backend/app/autotune.py)."""
    stored = _get_system(system_id)
    try:
        return autotune.autotune(stored, request)
    except services.InvalidSimulationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
