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
