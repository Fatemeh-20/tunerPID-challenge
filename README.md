# Controller Tuner Platform

A web app around the `src/core` simulation engine: upload a dynamics file, choose a controller,
tune its gains with sliders or exact numbers, run a simulation, and compare runs.

- **Backend:** FastAPI (`backend/`), a thin layer over `src.core` (the engine is untouched).
- **Frontend:** React + Vite + Tailwind + Recharts (`frontend/`).
- **Docker Compose:** one command starts both services behind an nginx proxy.

## Quick start (Docker)

```bash
docker-compose up --build     # or: docker compose up --build
```

Open <http://localhost:3000>. API docs: <http://localhost:8000/docs>.

Then: upload `case_studies/BallBeam.py` → choose **PID** → set Kp 2, Ki 0, Kd 1 → **Run simulation**.

> **DCMotor** is stiff: set `dt` to `0.001` (duration 2 s). With the default `dt = 0.01` the
> Euler integration of its electrical dynamics is numerically unstable for every gain.

If Docker Hub, pip or npm are slow or blocked, copy `.env.example` to `.env` and uncomment the mirror lines.

## Run without Docker

```bash
pip install -r backend/requirements-dev.txt
python -m uvicorn backend.app.main:app --reload --port 8000     # terminal 1, from the repo root

cd frontend && npm install && npm run dev                       # terminal 2 → http://localhost:5173
```

## Features

- Upload a `.py` dynamics file; controllers **P, PI, PD, PID, FSF** with gain sliders built from the backend schema.
- Exact numeric input next to every slider (accepts Persian digits and decimal commas), **Reset gains** button.
- Response and control charts with the target line, plus the engine's metrics and a stable/unstable badge.
- **Run history:** every run is kept (last 12); tick any runs to overlay them, click one to see its metrics.
- **CSV download** of any run.
- **Auto-tune gains:** random search (200 samples, biased to small gains) followed by a pattern search from the best five.
  The score uses the engine's outputs (RMSE, overshoot, settling time, control effort) plus a penalty when the response first moves
  away from the target; unstable runs rank last.
  It is deterministic and takes a few seconds. It finds good, stable gains, not a guaranteed optimum.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/upload` | Upload a `.py` file → `{system_id, name, num_states}` |
| GET | `/api/v1/systems/{id}/schema?controller_type=PID` | Gain ranges (`min`/`max`) per gain |
| POST | `/api/v1/systems/{id}/simulate` | Run a simulation → time series + metrics |
| POST | `/api/v1/systems/{id}/autotune` | Search the gain ranges → best gains + their simulation |
| GET | `/api/v1/health` | Liveness check |

Errors: `400` wrong file type or empty, `413` file over 100 KB, `404` unknown system, `422` unsafe/invalid file or invalid request.

## Design decisions and assumptions

- **Fixed initial state.** The engine starts from a random state when none is given, so identical gains would give different
  curves. The API starts with the output state at 1.0 and the others at 0 (override with `system_config.initial_state`).
- **JSON-safe results.** `inf`/`NaN` metrics are returned as `null` (shown as "∞"); if a response diverges, the series are cut
  at the first non-finite value and `diverged: true` is set.
- **Storage is in memory** (a dictionary, oldest of 50 systems evicted). A lock per system protects the engine's shared settings.
- **Upload safety is basic hardening, not a sandbox.** Files are limited to 100 KB, parsed with `ast`, and rejected if they import
  anything outside `numpy`/`math`-style modules, call `eval`/`exec`/`open`, or touch dunder attributes. Uploaded code still runs
  in the server process, so a file with an infinite loop could block a worker. Production use would need process isolation.

## Tests and CI

```bash
python -m pytest backend/tests        # API, safety checks, divergence handling, auto-tune
(cd frontend && npm test)             # number parsing, gain fields, metrics, run history, graded UI flow
./scripts/smoke_test.sh               # graded flow through the running Docker stack
```

GitHub Actions (`.github/workflows/ci.yml`) runs the backend tests, the frontend tests and build and the Docker smoke test.

## Future work

- Use ITAE as the auto-tune objective, or a genetic algorithm as the search.
- Seed the search with Ziegler–Nichols gains for plants that have a finite ultimate gain or an S-shaped step response
  (none of the three bundled examples do, so it is not used today).
- Run uploaded code in a separate process with a timeout and resource limits.

## Project layout

```
backend/    FastAPI app: main.py (routes), schemas.py, services.py (engine glue), autotune.py, safety.py, store.py, tests/
frontend/   React app: App.jsx, components/, hooks/useRuns.js, api.js, csv.js, utils.js, nginx.conf, Dockerfile
src/        provided engine (unchanged)        streamlit/, case_studies/   provided prototype and examples
```
