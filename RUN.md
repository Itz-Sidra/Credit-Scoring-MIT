# How to Run CREDIT

**Repo:** [https://github.com/Umar-Jahangir/Credit-Scoring](https://github.com/Umar-Jahangir/Credit-Scoring)

This guide covers **local development** (MongoDB + Redis + Node + Python) and **Docker Compose**. Default URLs:

- **Frontend:** `http://localhost:5173`
- **Backend:** `http://localhost:8000`
- **API base (dev):** `http://localhost:8000/api`

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | LTS (18+ recommended); matches `backend` / `frontend` package engines if specified |
| **npm** | Comes with Node |
| **Python** | **3.10+** recommended for ML bridge (`python3` on Linux/macOS; on Windows use `py -3.10` or install Python and ensure `python` is on PATH) |
| **MongoDB** | Local `mongodb://localhost:27017/...` or **MongoDB Atlas** URI |
| **Redis** | Local `redis://localhost:6379` (OTP / ephemeral state) |
| **Shell** | `npm run dev` runs `sh scripts/dev-all.sh` — use **Git Bash**, **WSL**, or macOS/Linux. On pure **cmd/PowerShell**, start backend and frontend separately (below). |
| **Docker** (optional) | Docker Desktop for Compose stack |

---

## 1. Clone and install

```bash
git clone https://github.com/Umar-Jahangir/Credit-Scoring.git
cd Credit-Scoring

npm --prefix ./backend install
npm --prefix ./frontend install
```

**Python dependencies** (root file re-exports backend ML requirements):

```bash
python3 -m pip install -r requirements.txt
```

On Windows, if `python3` is missing:

```powershell
py -3.10 -m pip install -r requirements.txt
```

---

## 2. Configure environment

### Backend (`backend/.env`)

Copy the template and edit:

```bash
cp backend/.env.example backend/.env
```

Minimum variables to set:

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | e.g. `mongodb://127.0.0.1:27017/credit` or Atlas SRV URI |
| `REDIS_URL` | e.g. `redis://127.0.0.1:6379` |
| `JWT_SECRET` | ≥ 32 chars |
| `JWT_REFRESH_SECRET` | ≥ 32 chars |
| `ALLOWED_ORIGINS` | Comma-separated; include `http://localhost:5173` for Vite dev |

Email OTP (pick a working combo):

| Variable | Purpose |
|----------|---------|
| `OTP_MAIL_MODE` | `auto`, `ethereal`, or `gmail` |
| `EMAIL_USER` / `EMAIL_PASSWORD` | SMTP credentials (e.g. Gmail app password) |
| `ALLOW_EMAIL_OTP_FALLBACK` | `true` for local demo if SMTP fails (**not for production**) |

ML paths (defaults OK if files exist under `backend/`):

| Variable | Purpose |
|----------|---------|
| `ML_PYTHON_BIN` | e.g. `python3` or `py -3.10` on Windows |
| `ML_MANIFEST_PATH` | Path to serving manifest JSON |
| `ML_ARTIFACT_PATH` | Path to model pickle |
| `ML_INFERENCE_TIMEOUT_MS` | Inference timeout |

**Document OCR (optional):**

| Variable | Purpose |
|----------|---------|
| `AWS_REGION` | e.g. `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | IAM key with Textract access |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |

Without AWS, uploads may still be stored but Textract analysis will fail unless you mock or skip OCR in your demo path.

**Analyst copilot (optional):**

| Variable | Purpose |
|----------|---------|
| `OLLAMA_BASE_URL` | Default `http://localhost:11434` |
| `OLLAMA_MODEL` | e.g. `qwen2.5:14b` (must be pulled in Ollama) |
| `OLLAMA_TIMEOUT_MS` | Request timeout |

### Frontend (`frontend/.env` or `.env.local`)

```bash
cp frontend/.env.example frontend/.env
```

Typical dev value:

```
VITE_API_URL=http://localhost:8000/api
```

---

## 3. Start MongoDB and Redis

**MongoDB** — install locally or use Atlas, then ensure `MONGO_URI` matches.

**Redis** — examples:

```bash
# macOS (Homebrew)
brew services start redis

# Docker (one-off)
docker run -d -p 6379:6379 redis:7-alpine
```

---

## 4. Run the app (local)

### Option A — One command (Unix-like shell)

From repo root:

```bash
npm run dev
```

This runs `scripts/dev-all.sh`: starts backend (`dev:local`), waits for `/api/health`, then starts Vite.

### Option B — Two terminals (works everywhere, including Windows)

**Terminal 1 — backend**

```bash
npm --prefix ./backend run dev:local
```

On Windows, if `NODE_ENV=development` fails in npm script, use:

```powershell
cd backend
$env:NODE_ENV="development"; node --env-file=.env src/index.js
```

Or install a Unix-like environment and use the npm script as-is.

**Terminal 2 — frontend**

```bash
npm --prefix ./frontend run dev
```

### Verify

```bash
curl -sS http://localhost:8000/api/health
curl -sS http://localhost:8000/api/health/ready
```

Open `http://localhost:5173` in the browser.

### Useful backend utilities

| Command | Description |
|---------|-------------|
| `npm --prefix ./backend run email-otp -- user@example.com` | Print latest email OTP from Redis (debug) |
| `npm --prefix ./backend run seed` | Seed users (if configured) |

---

## 5. Run with Docker Compose

1. Ensure `backend/.env` exists (Compose loads it via `env_file` — see `docker-compose.yml`).
2. For Compose variable substitution, create **`.env.docker`** at repo root (see `.env.docker.example` for a template). Example:

   ```bash
   cp .env.docker.example .env.docker
   # Edit JWT secrets, email, and ensure MONGO_URI matches service name when using in-container Mongo:
   # MONGO_URI=mongodb://mongodb:27017/test
   ```

3. From repo root:

   ```bash
   npm run docker:up
   ```

Default Compose mapping (see `docker-compose.yml`):

- Frontend/nginx: **`http://localhost:80`**
- MongoDB: `localhost:27017`
- Redis: `localhost:6379`
- Backend is exposed internally to the frontend container; override ports if you need direct host access to the API.

Tear down:

```bash
npm run docker:down
```

---

## 6. Optional: Ollama (copilot)

1. Install [Ollama](https://ollama.com/) and pull your model, e.g.:

   ```bash
   ollama pull qwen2.5:14b
   ```

2. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `backend/.env` to match.

3. Restart the backend. Chat features degrade gracefully if Ollama is down.

---

## 7. Smoke tests & demos

From repo root:

```bash
npm run smoke:ml
npm run smoke:phase4
npm run smoke:phase5
npm run demo:priority1
```

Frontend production build check:

```bash
npm --prefix ./frontend run build
```

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Backend exits immediately | `MONGO_URI`, `REDIS_URL`, `JWT_*` in `backend/.env`; Mongo/Redis actually running |
| `npm run dev` fails on Windows | Use Git Bash/WSL, or run backend + frontend separately (§4B) |
| CORS errors | `ALLOWED_ORIGINS` includes your frontend origin (e.g. `http://localhost:5173`) |
| ML errors / timeout | `ML_PYTHON_BIN` points to the interpreter where `pip install -r requirements.txt` was run; paths to manifest/artifact exist |
| `No module named 'shap'` | Install root `requirements.txt` (includes SHAP for alternate pipelines) |
| OCR fails | AWS credentials and region; image must be JPG/PNG per API |
| Email OTP not received | SMTP settings; for local demos, `ALLOW_EMAIL_OTP_FALLBACK=true` may expose debug OTP in API responses (dev only) |

---

## Quick reference

| File | Role |
|------|------|
| `backend/.env.example` | Backend configuration template |
| `frontend/.env.example` | `VITE_API_URL` for API |
| `.env.docker.example` | Docker-related root env hints |
| `docs/BarclaysFinal.postman_collection.json` | API collection |
| `docs/DEPLOYMENT_CHECKLIST.md` | Production checklist |

For project overview and architecture, see **[README.md](./README.md)**.
