# Hack-o-Hire Barclays Hackathon Backend

Data Modelling:

## Contracts

- API contracts: `docs/API_CONTRACTS.md`

## Smoke Test (Phase 4)

Run against an already running backend instance:

```bash
USER_TOKEN=<user_jwt> ADMIN_TOKEN=<admin_jwt> npm run smoke:phase4
```

## Smoke Test (Phase 5)

```bash
npm run smoke:phase5
```

## Health Endpoints

- `GET /api/health`
- `GET /api/health/ready`

## Admin login (after seed)

1. **Seed the database** (creates admins and demo users).  
   - **Local:** `npm run seed` (uses `backend/.env`).  
   - **Docker (backend must be up):** `docker compose exec backend npm run seed:docker` — the container already has `MONGO_URI` from Compose; do not rely on `--env-file=.env` inside the image.

2. On the site, choose **ADMIN**, then sign in with:
   - **Personal loan admin:** `admin.personal@altcredit.com` / `Password@123`  
   - Other loan types: `admin.home@altcredit.com`, `admin.education@altcredit.com`, etc. (same password).

If login says **User not found**, the seed step did not run against the same MongoDB your API uses.
