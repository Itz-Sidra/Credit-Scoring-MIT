#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env.docker ]; then
  echo "Missing .env.docker"
  echo "Create it from .env.docker.example and fill required values first."
  exit 1
fi

docker compose --env-file .env.docker pull || true
docker compose --env-file .env.docker up -d --build

echo "\nContainer status:" 
docker compose --env-file .env.docker ps

echo "\nBackend health via frontend proxy:" 
curl -sS http://localhost/api/health | head -c 400 || true

echo "\nDeploy complete."