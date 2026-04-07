# Deployment Checklist

## 1. Environment And Secrets

- Confirm backend .env values are set for deployment target.
- Rotate and replace any exposed credentials before final deployment.
- Set JWT secrets, Redis URL, Mongo URI, email/SMS credentials.
- Verify ML model env overrides if using non-default paths.

## 2. Backend Readiness

- Install dependencies:
  - npm --prefix ./backend install
- Start backend:
  - npm --prefix ./backend run start
- Verify health endpoints:
  - GET /api/health returns status ok
  - GET /api/health/ready returns ready true

## 3. Frontend Readiness

- Install dependencies:
  - npm --prefix ./frontend install
- Build frontend:
  - npm --prefix ./frontend run build
- Set VITE_API_URL to deployed backend API base URL.

## 4. End-To-End Validation

- Run backend smoke tests:
  - npm --prefix ./backend run smoke:phase4
  - npm --prefix ./backend run smoke:phase5
- Validate admin flows manually:
  - list loans
  - fetch loan detail
  - explainability endpoint
  - approve/reject actions

## 5. Operational Checks

- Review backend logs for runtime exceptions.
- Confirm database connectivity and index health.
- Confirm Redis connectivity and OTP workflow.
- Confirm email notifications are delivered or handled gracefully on failure.

## 6. Security Checks

- Ensure no secrets are committed to repository.
- Validate CORS allowlist for production origins.
- Validate auth-protected routes reject unauthorized requests.
- Ensure admin routes require admin role.

## 7. Demo Day Runbook

- Start stack with one command from workspace root:
  - npm run dev
- If backend fails to start with nodemon, use start script (already configured in root runner).
- Use docs/BarclaysFinal.postman_collection.json for live API walkthrough.

## 8. AWS Free-Credit EC2 Path (Simple)

See full step-by-step guide: **docs/EC2_DEPLOY_GUIDE.md**

Quick summary:
1. Launch t3.micro Ubuntu EC2 in AWS Console, open ports 22 + 80
2. SSH in with your .pem key
3. Install Docker: `curl -fsSL https://get.docker.com | sudo sh`
4. Copy project with rsync from your Mac
5. Fill `.env.docker` (Mongo URI, JWT secrets, Gmail, ALLOWED_ORIGINS)
6. Run `bash scripts/ec2-deploy.sh`
7. Open `http://YOUR_EC2_IP` in browser
