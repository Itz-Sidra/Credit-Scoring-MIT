/**
 * Lookup Handler  (Phase 5 — Chat Handlers)
 * Intent: applicant_lookup
 *
 * Retrieves an ApplicantCard by applicationId and returns a human-readable
 * structured summary.  LLM is intentionally NOT used here — the card data
 * is already clean enough for direct display.
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Only calls Phase 2 fetch service (read-only).
 *  - No existing file modified.
 *  - Never exposes auth fields.
 */

import { getApplicantCardByApplicationId } from "../applicantFetchService.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v, unit = "") {
  if (v === null || v === undefined) return "not recorded";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return `${v}${unit}`;
}

function fmtAmount(v) {
  if (v === null || v === undefined) return "not recorded";
  return `₹${Number(v).toLocaleString("en-IN")}`;
}

/**
 * Converts an ApplicantCard into a clean plain-English summary string.
 * This is returned directly as the answer — no LLM pass required.
 */
function buildSummaryText(card) {
  const lines = [];

  lines.push(`Application ID: ${card.applicationId}`);
  lines.push(`Applicant: ${card.applicantName}`);
  lines.push(`Loan Type: ${fmt(card.loanType)} | Purpose: ${fmt(card.purpose)}`);
  lines.push(
    `Requested: ${fmtAmount(card.requestedAmount)} over ${fmt(card.requestedTenure, " months")}`
  );
  lines.push(`Status: ${fmt(card.status)}`);
  lines.push("");

  lines.push("── Decision ──");
  lines.push(`Decision: ${fmt(card.decision)}`);
  lines.push(`Risk Level: ${fmt(card.riskLevel)}`);
  lines.push(`Probability of Default: ${card.probabilityOfDefault != null ? (card.probabilityOfDefault * 100).toFixed(1) + "%" : "not available"}`);
  lines.push(`Pre-Screen Status: ${fmt(card.preScreenStatus)}`);
  lines.push(`Eligible Amount: ${fmtAmount(card.eligibleAmount)}`);
  if (card.decisionReason) lines.push(`Decision Reason: ${card.decisionReason}`);
  lines.push("");

  lines.push("── Applicant Profile ──");
  lines.push(`Borrower Type: ${fmt(card.borrowerType)}`);
  lines.push(`Age: ${fmt(card.age)} | Gender: ${fmt(card.gender)} | Occupation: ${fmt(card.occupation)}`);
  lines.push(`Credit Score: ${fmt(card.creditScore)}`);
  if (card.monthlyIncome != null)
    lines.push(`Monthly Income: ${fmtAmount(card.monthlyIncome)}`);
  if (card.annualIncomeEstimate != null)
    lines.push(`Annual Income Estimate: ${fmtAmount(card.annualIncomeEstimate)}`);
  if (card.totalExistingEmiBurden != null)
    lines.push(`Existing EMI Burden: ${fmtAmount(card.totalExistingEmiBurden)}`);
  lines.push("");

  lines.push("── Risk Factors ──");
  if (card.topPositiveFactors?.length)
    lines.push(`Strengths: ${card.topPositiveFactors.join("; ")}`);
  if (card.topNegativeFactors?.length)
    lines.push(`Concerns: ${card.topNegativeFactors.join("; ")}`);
  if (card.amlFlags?.length)
    lines.push(`AML Flags: ${card.amlFlags.join(", ")}`);
  lines.push("");

  lines.push("── Verification ──");
  lines.push(`Docs Verified: ${fmt(card.docsVerified)} | Identity Verified: ${fmt(card.identityVerified)}`);
  lines.push(`Bank Account: ${fmt(card.hasBankAccount)} | UPI History: ${fmt(card.hasUpiHistory)}`);

  return lines.join("\n");
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * @param {string|null} applicationId
 * @param {object} routedQuery - from Phase 4 routeQuery()
 * @returns {object} standardised handler response
 */
export async function lookupHandler(applicationId, routedQuery) {
  if (!applicationId) {
    return {
      intent: "applicant_lookup",
      answer:
        "To look up an applicant, please provide a valid application ID (the 24-character reference shown in the admin panel). " +
        "Example: 'Show application 69c7c8d1457f8adf69e556dd'",
      sources: [],
      contextType: "unsupported",
      metadata: { reason: "no_application_id" },
    };
  }

  let card;
  try {
    card = await getApplicantCardByApplicationId(applicationId);
  } catch (err) {
    return {
      intent: "applicant_lookup",
      answer: `Unable to fetch application: ${err.message}`,
      sources: [],
      contextType: "unsupported",
      metadata: { error: err.message },
    };
  }

  if (!card) {
    return {
      intent: "applicant_lookup",
      answer: `No application found with ID ${applicationId}. Please verify the ID and try again.`,
      sources: [applicationId],
      contextType: "unsupported",
      metadata: { applicationId, reason: "not_found" },
    };
  }

  return {
    intent: "applicant_lookup",
    answer: buildSummaryText(card),
    sources: [card.applicationId],
    contextType: "applicant_card",
    metadata: {
      applicationId: card.applicationId,
      applicantName: card.applicantName,
      status: card.status,
      decision: card.decision,
      riskLevel: card.riskLevel,
    },
  };
}
