# Credit Score Workspace

This workspace is organized for clean full-stack development with separate frontend and backend projects.

## Structure

- backend: Node.js/Express APIs, ML integration bridge, admin/user loan workflows
- frontend: React/Vite UI for borrower and admin portals
- docs: deployment checklist and API collection for demo/testing
- scripts: root orchestration scripts

## Problem Statement
Over 1.4 billion people globally lack formal credit history. This leads to:
- MSMEs and gig workers being rejected for loans
- Lenders struggling to balance financial inclusion with portfolio risk
- Widespread financial exclusion and missed economic growth
Traditional credit scoring systems fail those who are unbanked or underbanked — not because they're risky, but because they're invisible to the system.

## Solution:
An end-to-end AI-powered digital underwriting platform that uses alternate data (UPI, GST, utility records) to assess creditworthiness — no credit history required.
What makes us different:
- No credit history required
- Real-time, data-driven risk scoring
- Explainable AI (SHAP insights)
- Continuous self-learning system

## How It Works (Algorithm Pipeline):
Input Data → Rule Checks → ML Scoring → Policy Guardrails → Recommendation → Human Approval → Final Outcome
### 1. Data Ingestion
- Collects OTP-verified identity, segment profile (Salaried / MSME / Farmer / Student), loan request details, income, liabilities, and OCR-verified documents via AWS Textract.
### 2. Pre-Screen (Rule-Based Gate)
### 3. Feature Engineering + ML Inference
### 4. Policy Guardrails
### 5. Decision + Explainability
### 6. Admin Review (Human-in-the-Loop)
### 7. Copilot / Analysis Chat

## One-Command Start (Recommended)

From workspace root:

```bash
npm run dev
```

This starts:

- backend on http://localhost:8000
- frontend on http://localhost:5173

## Daily Commands To Memorize

Run these from workspace root every time:

```bash
npm --prefix ./backend install
npm --prefix ./frontend install
python3 -m pip install -r requirements.txt
npm run dev
```

Quick health check:

```bash
curl -sS http://localhost:8000/api/health
```

## Individual Commands

Backend:

```bash
npm --prefix ./backend install
python3 -m pip install -r requirements.txt
npm --prefix ./backend run start
```

Frontend:

```bash
npm --prefix ./frontend install
npm --prefix ./frontend run dev
```

Frontend build check:

```bash
npm --prefix ./frontend run build
```

## Smoke Tests

```bash
npm run smoke:phase4
npm run smoke:phase5
```

## Priority 1 Demo Commands

```bash
npm run demo:priority1
```

This prints 3 benchmark borrower personas with:

- credit score
- repayment probability
- probability of default
- risk band

For UI explainability during demo, open the admin loans screen and select a loan:

- [frontend/src/app/components/AdminLoanApplications.tsx](frontend/src/app/components/AdminLoanApplications.tsx)

## Health Endpoints

- GET http://localhost:8000/api/health
- GET http://localhost:8000/api/health/ready

## Contracts And Collections

- API contracts: backend/docs/API_CONTRACTS.md
- Postman collection: docs/BarclaysFinal.postman_collection.json
- Deployment runbook: docs/DEPLOYMENT_CHECKLIST.md

## Environment

- Backend env: backend/.env and backend/.env.example
- Frontend env: frontend/.env.example

## Python Requirements

- Root Python requirements: [requirements.txt](/Users/shlokpalrecha/Desktop/BarclaysFinal/requirements.txt)
- Backend ML-specific Python requirements: [backend/requirements.txt](/Users/shlokpalrecha/Desktop/BarclaysFinal/backend/requirements.txt)

Install them from the workspace root:

```bash
python3 -m pip install -r requirements.txt
```
