#!/usr/bin/env bash
# End-to-end check of the graded flow through the nginx proxy (default: http://localhost:3000).
set -euo pipefail
BASE="${1:-http://localhost:3000}"

for _ in $(seq 1 30); do
  curl -fs "$BASE/api/v1/health" >/dev/null && break
  sleep 2
done

ID=$(curl -fs -F "file=@case_studies/BallBeam.py" "$BASE/api/v1/upload" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['system_id'])")
curl -fs "$BASE/api/v1/systems/$ID/schema?controller_type=PID" >/dev/null
curl -fs -X POST "$BASE/api/v1/systems/$ID/simulate" -H "Content-Type: application/json" \
  -d '{"controller_type":"PID","params":{"Kp":2,"Ki":0,"Kd":1}}' \
  | python3 -c "import sys, json; d = json.load(sys.stdin); assert d['success'] and d['metrics']['stable']; print('smoke test passed')"
curl -fs "$BASE/" | grep -q "<div id=\"root\">"
