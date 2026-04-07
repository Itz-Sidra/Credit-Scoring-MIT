# API Contracts (Phase 4)

This document captures stable request/response contracts currently consumed by the frontend.
All new fields are additive and should not replace existing keys used by UI components.

## Base URL

- Local: `http://localhost:8000/api`

## Auth

- `POST /auth/signup`
- `POST /auth/verify-otp`
- `POST /auth/verify-email-otp`
- `POST /auth/login`
- `POST /auth/verify-login-otp`
- `POST /auth/refresh-token`

## User-facing

### Get Profile

- `GET /user/profile`
- Auth: required
- Response shape:

```json
{
  "user": {
    "fullName": "...",
    "email": "...",
    "phone": "..."
  }
}
```

### Apply Loan

- `POST /loan/apply`
- Auth: required
- Request (minimum):

```json
{
  "loanType": "personal",
  "requestedAmount": 100000,
  "requestedTenure": 24
}
```

- Response (non-breaking + additive):

```json
{
  "message": "Loan application submitted successfully",
  "data": {
    "loanId": "...",
    "loan": {},
    "status": "under_review"
  },
  "decisionOutput": {
    "credit_score": 650,
    "probability_of_default": 0.42,
    "risk_band": "medium",
    "recommended_loan_amount": 80000,
    "interest_range": "11.5%-15.5%",
    "decision": "Hold",
    "decision_reason": "...",
    "flags": []
  }
}
```

### My Loans

- `GET /loan/my-loans`
- `GET /loan/my-loans/:loanId`
- Auth: required
- Stable keys used by frontend:
  - `aiAnalysis.creditScore`
  - `aiAnalysis.riskLevel`
  - `aiAnalysis.eligibleAmount`
  - `aiAnalysis.suggestedInterestRate`

## Admin-facing

### Dashboard

- `GET /admin/dashboard`
- Auth: admin
- Metrics include additive `riskDistribution`:

```json
{
  "metrics": {
    "totalApplications": 0,
    "approvedLoans": 0,
    "rejectedLoans": 0,
    "pendingLoans": 0,
    "totalDisbursed": 0,
    "activeLoans": 0,
    "riskDistribution": {
      "low": 0,
      "medium": 0,
      "high": 0,
      "unknown": 0
    }
  }
}
```

### Admin Loans

- `GET /admin/my-loans`
- `GET /admin/my-loans/:loanId`
- Auth: admin
- Query filters (all optional, CSV allowed):
  - `loanType=personal,home,...`
  - `status=under_review,approved,...`
  - `risk=low,medium,high`
  - `decision=approve,hold,reject`
  - `preScreenStatus=pass,review,reject`
- Additive loan field:

```json
{
  "decisionSummary": {
    "decision": "Hold",
    "decisionReason": "...",
    "preScreenStatus": "review",
    "manualReviewRequired": true,
    "probabilityOfDefault": 0.47,
    "flags": [],
    "scoringSource": "ml_model"
  }
}
```

### Explainability

- `GET /admin/loans/:loanId/explainability`
- Auth: admin
- Response shape:

```json
{
  "loanId": "...",
  "loanType": "personal",
  "status": "under_review",
  "explainability": {
    "modelVersion": "winner_upgrade_v5",
    "probabilityOfDefault": 0.42,
    "riskLevel": "medium",
    "creditScore": 651,
    "explanationSummary": [],
    "flags": [],
    "decisionSummary": {}
  },
  "applicant": {
    "id": "...",
    "fullName": "...",
    "email": "...",
    "phone": "..."
  }
}
```

### Admin Actions

- `PATCH /admin/loans/:loanId/approve`
- `PATCH /admin/loans/:loanId/reject`
- Auth: admin

## Compatibility Rules

1. Keep existing `aiAnalysis.*` keys unchanged.
2. Add fields only; do not rename current fields used by frontend pages.
3. Keep status enums in `LoanApplication` unchanged.
