#!/bin/sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PID=""
BACKEND_LOG="/tmp/barclays_backend_dev.log"

wait_for_backend() {
  ATTEMPTS=30
  while [ "$ATTEMPTS" -gt 0 ]; do
    if curl -fsS "http://localhost:8000/api/health" >/dev/null 2>&1; then
      return 0
    fi

    if [ -n "$BACKEND_PID" ] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo "Backend process exited early. Last logs:"
      tail -40 "$BACKEND_LOG" 2>/dev/null || true
      return 1
    fi

    ATTEMPTS=$((ATTEMPTS - 1))
    sleep 1
  done

  echo "Backend did not become healthy at http://localhost:8000/api/health"
  tail -40 "$BACKEND_LOG" 2>/dev/null || true
  return 1
}

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "\nStopping backend (PID $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting backend on http://localhost:8000 ..."
npm --prefix "$ROOT_DIR/backend" run dev:local >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

wait_for_backend
echo "Backend is healthy."

echo "Starting frontend on http://localhost:5173 ..."
npm --prefix "$ROOT_DIR/frontend" run dev
