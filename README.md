# CREDIT — AI-Assisted Alternative Credit Underwriting

**Repository:** [https://github.com/Umar-Jahangir/Credit-Scoring](https://github.com/Umar-Jahangir/Credit-Scoring)

CREDIT is a full-stack hackathon-style platform for **digital loan applications** when applicants have **thin or no traditional credit history**. Borrowers complete OTP-verified signup, segment-aware profiles, loan requests, and optional **document OCR**; the backend runs **rule-based pre-screening**, **ML risk scoring** (Python bridge), and **policy guardrails**, then surfaces results to **admin review** with explainability and an optional **LLM copilot**.

---

## What It Does

- **Borrowers:** email/OTP authentication, profile by segment (e.g. salaried, MSME, farmer, student), loan application, document upload, status and credit views.
- **Admins:** portfolio-style monitoring, loan queue, decision support (risk, eligible amount, flags), approve/reject with notes, optional chat assistant.
- **Underwriting engine:** deterministic checks first, then ML inference, then business rules that cap and adjust recommendations before human sign-off.

---

## How It Works (Pipeline)

```
Input data → Pre-screen (rules) → Feature + ML scoring → Policy guardrails → Stored decision / explainability → Admin approval → Final status
```

1. **Ingestion** — Profile, loan request, collateral hints, and optional **AWS Textract** identity document analysis.
2. **Pre-screen** — Fast flags (e.g. age, amount/tenure bounds, identity verification, loan-to-income bands). Hard failures can auto-reject; other flags route to manual review.
3. **ML** — Node invokes Python to score risk (primary **Winner v5** serving path; alternate paths can expose **SHAP**-style explanations where configured).
4. **Policy** — Combines model risk band with multipliers and **income-based caps** (annual-income multiples depend on risk tier), plus auto-approve / auto-reject thresholds for some cases.
5. **Persistence** — Decisions and analysis land in **MongoDB**; OTP-related state uses **Redis**.
6. **Human-in-the-loop** — Admins confirm or override with audit-friendly actions.
7. **Copilot (optional)** — **Ollama**-hosted models can answer analyst questions grounded on application context.

For **installation, environment variables, and commands**, see **[RUN.md](./RUN.md)**.

---

## Repository Layout

| Path | Purpose |
|------|---------|
| `frontend/` | React + TypeScript + Vite UI (borrower + admin) |
| `backend/` | Express API, auth, loan flow, ML bridge, OCR, chat integration |
| `docs/` | Postman collection, deployment checklist, EC2 notes |
| `scripts/` | Root dev orchestration (`dev-all.sh`) |
| `docker-compose.yml` | Redis, MongoDB, backend, frontend (nginx) |

---

## Tech Stack

| Layer | Technologies |
|--------|----------------|
| UI | React, TypeScript, Vite, MUI, Radix |
| API | Node.js, Express (ESM), JWT, role middleware |
| Data | MongoDB (Mongoose), Redis (ioredis) |
| ML | Python, scikit-learn, XGBoost, SHAP (alternate path) |
| OCR | AWS Textract (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) |
| Analyst AI | Ollama (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`) |
| Containers | Docker Compose |

---

## Research / Datasets (Modeling Context)

Public datasets referenced for experimentation and benchmarking include **Kaggle Home Credit**, **Lending Club**, **German Credit (UCI)**, **Give Me Some Credit**, plus **synthetic** augmentation for thin-file scenarios. Production serving uses the integrated model artifacts under `backend/models/…` as configured via env.

---

## API & Operations

| Resource | Location |
|----------|----------|
| Postman | `docs/BarclaysFinal.postman_collection.json` |
| API notes | `backend/docs/API_CONTRACTS.md` |
| Deployment | `docs/DEPLOYMENT_CHECKLIST.md`, `docs/EC2_DEPLOY_GUIDE.md` |
| Health | `GET /api/health`, `GET /api/health/ready` (backend default `http://localhost:8000`) |

---

## Scripts (from repo root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Starts backend + frontend via `scripts/dev-all.sh` (needs `sh`; see RUN.md on Windows) |
| `npm run dev:backend` / `npm run dev:frontend` | Start one side only |
| `npm run docker:up` / `docker:down` | Docker Compose stack |
| `npm run demo:priority1` | Sample benchmark personas (terminal) |
| `npm run smoke:phase4` / `smoke:phase5` | Backend smoke scripts |
| `npm run smoke:ml` | ML service smoke test |

---

## Contributing / Team

Issues and PRs welcome on **[GitHub](https://github.com/Umar-Jahangir/Credit-Scoring)**. For local setup and troubleshooting, use **[RUN.md](./RUN.md)**.
