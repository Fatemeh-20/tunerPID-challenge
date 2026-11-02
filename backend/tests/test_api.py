"""Run from the repo root:  python -m pytest backend/tests"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.store import store

CASES = Path(__file__).resolve().parents[2] / "case_studies"
PID = {"Kp": 15.0, "Ki": 0.5, "Kd": 2.0}


@pytest.fixture()
def client():
    store.clear()
    return TestClient(app)


def upload(client, name="BallBeam.py", content=None):
    data = content if content is not None else (CASES / name).read_bytes()
    return client.post("/api/v1/upload", files={"file": (name, data, "text/x-python")})


@pytest.mark.parametrize("name", ["BallBeam.py", "DCMotor.py", "InvPendulum.py"])
def test_upload_all_case_studies(client, name):
    res = upload(client, name)
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == name[:-3]
    assert body["num_states"] == 2


def test_schema_per_controller(client):
    sid = upload(client).json()["system_id"]
    pid = client.get(f"/api/v1/systems/{sid}/schema", params={"controller_type": "PID"}).json()
    assert set(pid) == {"Kp", "Ki", "Kd"}
    fsf = client.get(f"/api/v1/systems/{sid}/schema", params={"controller_type": "FSF"}).json()
    assert set(fsf) == {"K1", "K2"}


def test_simulate_happy_path_is_reproducible(client):
    sid = upload(client).json()["system_id"]
    body = {"controller_type": "PID", "params": PID}
    first = client.post(f"/api/v1/systems/{sid}/simulate", json=body)
    second = client.post(f"/api/v1/systems/{sid}/simulate", json=body)
    assert first.status_code == 200
    data = first.json()
    assert data["success"] is True
    assert len(data["time_points"]) == len(data["trajectory"]) == len(data["control_signals"])
    assert data["trajectory"][0] == 1.0
    assert "settling_time" in data["metrics"] and "stable" in data["metrics"]
    assert data["trajectory"] == second.json()["trajectory"]


def test_simulate_fsf(client):
    sid = upload(client, "DCMotor.py").json()["system_id"]
    res = client.post(
        f"/api/v1/systems/{sid}/simulate",
        json={"controller_type": "FSF", "params": {"K1": 5.0, "K2": 1.0}},
    )
    assert res.status_code == 200


def test_unstable_run_returns_valid_json(client):
    # Undamped ball-and-beam: the engine reports settling_time = inf, which
    # is not valid JSON, so the API must send null instead.
    sid = upload(client).json()["system_id"]
    res = client.post(
        f"/api/v1/systems/{sid}/simulate",
        json={"controller_type": "P", "params": {"Kp": 0.1}},
    )
    assert res.status_code == 200
    metrics = res.json()["metrics"]
    assert metrics["stable"] is False
    assert metrics["settling_time"] is None


def test_diverged_series_are_cut_at_first_non_finite_value():
    from backend.app.services import _to_response

    nan, inf = float("nan"), float("inf")
    raw = {
        "success": True,
        "time_points": [0.0, 0.1, 0.2, 0.3, 0.4],
        "trajectory": [1.0, 2.0, inf, nan, nan],
        "control_signals": [0.5, 0.5, 0.5, 0.5],  # one sample shorter
        "metrics": {"mse": nan, "rmse": inf, "settling_time": inf, "rise_time": inf,
                    "overshoot": 0.0, "ss_error": nan, "control_effort": 0.1,
                    "zero_crossings": 0, "stable": False},
    }
    out = _to_response(raw)
    assert out.diverged is True
    assert out.trajectory == [1.0, 2.0]
    assert len(out.time_points) == len(out.control_signals) == 2
    assert out.metrics.mse is None and out.metrics.settling_time is None


def test_unknown_system_is_404(client):
    assert client.get("/api/v1/systems/nope/schema").status_code == 404
    res = client.post("/api/v1/systems/nope/simulate",
                      json={"controller_type": "P", "params": {"Kp": 1.0}})
    assert res.status_code == 404


def test_rejects_wrong_extension(client):
    res = client.post("/api/v1/upload", files={"file": ("a.txt", b"x", "text/plain")})
    assert res.status_code == 400


def test_rejects_unsafe_code(client):
    res = upload(client, "evil.py", b"import os\ndef dynamics(t, x, u):\n    return x\n")
    assert res.status_code == 422
    assert "not allowed" in res.json()["detail"]


def test_rejects_file_without_dynamics(client):
    res = upload(client, "nodyn.py", b"import numpy as np\nvalue = 1\n")
    assert res.status_code == 422


def test_invalid_requests_are_422(client):
    sid = upload(client).json()["system_id"]
    url = f"/api/v1/systems/{sid}/simulate"
    assert client.post(url, json={"controller_type": "XYZ", "params": {}}).status_code == 422
    assert client.post(url, json={"controller_type": "PID", "params": {"Kp": 1.0}}).status_code == 422
    out_of_range = {"controller_type": "PID", "params": {"Kp": 999.0, "Ki": 0.0, "Kd": 0.0}}
    assert client.post(url, json=out_of_range).status_code == 422
    bad_cfg = {"controller_type": "PID", "params": PID, "system_config": {"dt": 0.001, "max_time": 600}}
    assert client.post(url, json=bad_cfg).status_code == 422


@pytest.mark.parametrize("name,controller", [
    ("BallBeam.py", "PID"), ("BallBeam.py", "PD"), ("DCMotor.py", "PI"), ("InvPendulum.py", "FSF"),
])
def test_autotune_returns_in_range_gains_and_beats_the_midpoint(client, name, controller):
    sid = upload(client, name).json()["system_id"]
    schema = client.get(f"/api/v1/systems/{sid}/schema", params={"controller_type": controller}).json()
    res = client.post(f"/api/v1/systems/{sid}/autotune", json={"controller_type": controller})
    assert res.status_code == 200
    body = res.json()
    for key, value in body["params"].items():
        assert schema[key]["min"] <= value <= schema[key]["max"]
    midpoint = {k: (r["min"] + r["max"]) / 2 for k, r in schema.items()}
    base = client.post(f"/api/v1/systems/{sid}/simulate",
                       json={"controller_type": controller, "params": midpoint}).json()
    from backend.app.autotune import score
    assert body["cost"] <= score(base, 5.0, 0.0) + 1e-9
    assert body["result"]["metrics"]["stable"] is True


def test_autotune_is_deterministic_and_unknown_system_is_404(client):
    sid = upload(client).json()["system_id"]
    first = client.post(f"/api/v1/systems/{sid}/autotune", json={"controller_type": "PID"}).json()
    second = client.post(f"/api/v1/systems/{sid}/autotune", json={"controller_type": "PID"}).json()
    assert first["params"] == second["params"]
    assert client.post("/api/v1/systems/nope/autotune", json={"controller_type": "PID"}).status_code == 404
