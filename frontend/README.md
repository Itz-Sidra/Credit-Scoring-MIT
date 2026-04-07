# CREDIT
CREDIT — AI-Powered Alternative Credit Scoring Platform
An AI-driven credit assessment and lending platform that enables unbanked and underbanked individuals to access financial services by evaluating alternative data sources and behavioral signals, rather than relying solely on traditional credit scores.

Problem Statement
Millions of individuals and MSMEs lack access to formal credit due to the absence of traditional credit histories. Existing credit systems rely on rigid parameters — past loans, credit cards, banking activity — excluding farmers, daily wage workers, gig workers, homemakers, and small business owners.

Solution
AltCredit evaluates creditworthiness using:

UPI and mobile transaction patterns
Utility bill payment consistency
E-commerce and GST activity (for MSMEs)
Asset and collateral value (pincode-based land valuation)
Repayment behavior that dynamically updates the score over time


Target Users

Unbanked individuals (no bank account or credit history)
Underbanked users (limited or inconsistent financial data)
Farmers, daily wage workers, gig workers
Homemakers and small business owners (MSMEs)
Students with no income


Tech Stack
LayerTechnologyFrontendReact + Tailwind CSSMain BackendNode.js + ExpressAI MicroservicePython + FastAPIDatabaseMongoDBCacheRedis (OTP storage)ML ModelsXGBoost, scikit-learn, SHAP, SMOTEAuthenticationbcrypt, JWT, MSG91 OTP, OpenCV face recognitionDocument VerificationTesseract OCR, Fernet AES-256 encryptionHostingRender (free tier)

Architecture
React Frontend
      ↓
Node.js + Express (main backend)
      ↓ calls when scoring needed
Python + FastAPI (AI microservice)
      ↓
XGBoost model + SHAP + AML flags

Core Features
User Portal

Register and login with password + OTP + face recognition
Borrower type selection — salaried, farmer, MSME, student, no income
Dynamic questionnaire based on borrower type and loan type
Credit score dashboard with SHAP-based factor breakdown
Loan application with collateral valuation by pincode
Active loan tracking and EMI repayment

AI Credit Scoring

Alternative data evaluation replacing traditional bureau scores
XGBoost primary model with Logistic Regression and Random Forest baselines
SHAP explainability — global and per-prediction explanations
AML rule engine — structuring detection, velocity spikes, round-trip flags
SMOTE for class imbalance handling
Fairness audit — disparate impact ratio, subgroup accuracy testing

Admin Portal

Review queue for medium-risk applications
Deep SHAP analysis — risk factors and beneficial signals per application
Approve with custom interest rate and tenure
Reject with reason codes

Progressive Credit Building

Stage 1 — Small loans, higher interest (high risk users)
Stage 2 — Improved score, larger loans, better rates
Stage 3 — Access to formal financial products (home, vehicle loans)

Post Disbursement Tracking

EMI reminders and repayment status
Score updates automatically based on repayment behaviour
Second loan eligibility check based on existing loan repayment percentage


Security

Passwords — bcrypt hashed, never stored in plain text
Aadhaar / PAN — AES-256 encrypted using Fernet
Data in transit — TLS 1.3 (HTTPS via Render)
Sessions — JWT access tokens (15 min) + refresh tokens (7 days)
OTP — 5 minute expiry, single use, stored in Redis
Rate limiting — max 5 failed login attempts then account lockout
Device binding — new device triggers re-verification
Audit logs — every action logged with timestamp and IP


Database Schemas

User — auth, personal details, documents, assets, nominee, credit score
BorrowerProfile — dynamic fields per borrower type, alternative data
LoanApplication — loan details, AI analysis output, admin decision, disbursement
Repayment — EMI schedule, payment status, score impact log
AuditLog — every system action with timestamp and IP


Compliance

DPDP Act 2023 — explicit granular consent per data source
RBI Fair Practices Code — SHAP-based explanation for every decision
PMLA 2002 — AML rule engine integrated into scoring pipeline
GDPR principles — purpose limitation, data minimisation, storage limitation
