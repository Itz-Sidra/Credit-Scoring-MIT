/**
 * Improvement Handler  (Phase 5 — Chat Handlers)
 * Intent: improvement_suggestion
 *
 * Fetches an ApplicantCard, extracts improvement-relevant context, and asks
 * the Phase 3 grounded Qwen engine what the applicant can realistically do
 * to strengthen their application.
 *
 * STRICT GUARDRAILS:
 *  - No guaranteed approval wording.
 *  - No fabricated financial advice.
 *  - Improvement suggestions are based only on detected weaknesses in the card.
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Only calls Phase 2 fetch + Phase 3 Ollama services.
 *  - No existing file modified.
 */

import { getApplicantCardByApplicationId } from "../applicantFetchService.js";
import { askGroundedCopilot }              from "../ollamaService.js";

// ── Context builder ───────────────────────────────────────────────────────────

/**
 * Extracts improvement-relevant fields: weaknesses, missing verifications,
 * income/EMI signals, collateral, and banking behaviour.
 */
function buildImprovementContext(card) {
  const lines = [];

  const row = (label, value) => {
    if (value === null || value === undefined) return;
    if (typeof value === "boolean") {
      lines.push(`${label}: ${value ? "Yes" : "No"}`);
      return;
    }
    lines.push(`${label}: ${value}`);
  };

  lines.push("=== Application Overview ===");
  row("Application ID",    card.applicationId);
  row("Loan Type",         card.loanType);
  row("Requested Amount",
    card.requestedAmount != null
      ? `₹${Number(card.requestedAmount).toLocaleString("en-IN")}`
      : null
  );
  row("Eligible Amount",
    card.eligibleAmount != null
      ? `₹${Number(card.eligibleAmount).toLocaleString("en-IN")}`
      : null
  );
  row("Decision",          card.decision);
  row("Pre-Screen Status", card.preScreenStatus);
  row("Decision Reason",   card.decisionReason);

  lines.push("\n=== Identified Weaknesses ===");
  if (card.topNegativeFactors?.length) {
    lines.push(`Flagged Concerns: ${card.topNegativeFactors.join("; ")}`);
  } else {
    lines.push("Flagged Concerns: none detected by model");
  }
  if (card.shapExplanation?.length) {
    lines.push(`Model Explanation: ${card.shapExplanation.join("; ")}`);
  }

  lines.push("\n=== Income & Repayment Capacity ===");
  row("Monthly Income",
    card.monthlyIncome != null
      ? `₹${Number(card.monthlyIncome).toLocaleString("en-IN")}`
      : null
  );
  row("Annual Income Estimate",
    card.annualIncomeEstimate != null
      ? `₹${Number(card.annualIncomeEstimate).toLocaleString("en-IN")}`
      : null
  );
  row("Existing EMI Burden",
    card.totalExistingEmiBurden != null
      ? `₹${Number(card.totalExistingEmiBurden).toLocaleString("en-IN")}`
      : null
  );
  row("Credit Score", card.creditScore);

  lines.push("\n=== Verification Gaps ===");
  row("Docs Verified",                  card.docsVerified);
  row("Identity Verified",              card.identityVerified);
  row("Bank Account Present",           card.hasBankAccount);
  row("UPI History Present",            card.hasUpiHistory);
  row("Transaction History Uploaded",   card.transactionHistoryUploaded);
  row("Salary Credited to Bank",        card.salaryCreditedToBank);
  if (card.loanType === "business" || card.borrowerType === "msme") {
    row("GST Registered",   card.hasGst);
    row("UDYAM Registered", card.hasUdyam);
  }

  lines.push("\n=== Collateral ===");
  row("Type",  card.collateralType);
  row("Value",
    card.collateralValue != null
      ? `₹${Number(card.collateralValue).toLocaleString("en-IN")}`
      : null
  );

  lines.push("\n=== Existing Strengths (for context) ===");
  if (card.topPositiveFactors?.length) {
    lines.push(card.topPositiveFactors.join("; "));
  } else {
    lines.push("None detected");
  }

  return lines.join("\n");
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * @param {string|null} applicationId
 * @param {object} routedQuery
 * @returns {object} standardised handler response
 */
export async function improvementHandler(applicationId, routedQuery) {
  if (!applicationId) {
    return {
      intent: "improvement_suggestion",
      answer:
        "To suggest improvements, please provide the application ID. " +
        "Example: 'What should applicant 69c7c8d1457f8adf69e556dd improve?'",
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
      intent: "improvement_suggestion",
      answer: `Unable to fetch application: ${err.message}`,
      sources: [],
      contextType: "unsupported",
      metadata: { error: err.message },
    };
  }

  if (!card) {
    return {
      intent: "improvement_suggestion",
      answer: `No application found with ID ${applicationId}.`,
      sources: [applicationId],
      contextType: "unsupported",
      metadata: { applicationId, reason: "not_found" },
    };
  }

  const context = buildImprovementContext(card);
  const question =
    routedQuery?.normalizedQuery ||
    "Based on the weaknesses and gaps in this application, what specific and realistic steps can this applicant take to strengthen their future application? " +
    "Do not promise approval. Only suggest what is directly supported by the data.";

  let answer;
  try {
    answer = await askGroundedCopilot({ question, context, intent: "improvement_suggestion" });
  } catch (err) {
    if (err.isOllamaUnavailable) {
      const fallback = ["Based on the available data, the following gaps were identified:"];
      if (card.topNegativeFactors?.length) {
        card.topNegativeFactors.forEach((f) => fallback.push(`• ${f}`));
      } else {
        fallback.push("• No specific concerns flagged.");
      }
      if (!card.docsVerified) fallback.push("• Documents are not verified — ensure all required documents are submitted.");
      if (!card.identityVerified) fallback.push("• Identity is not verified — complete KYC/OCR identity check.");
      if (!card.hasBankAccount) fallback.push("• No bank account on record — a formal bank account is typically required.");
      if (!card.hasUpiHistory) fallback.push("• No UPI transaction history — consistent digital payment activity helps.");
      fallback.push("\n[Detailed AI suggestions unavailable — Ollama is not reachable]");
      answer = fallback.join("\n");
    } else {
      answer = `Improvement analysis unavailable: ${err.message}`;
    }
  }

  return {
    intent: "improvement_suggestion",
    answer,
    sources: [card.applicationId],
    contextType: "applicant_card",
    metadata: {
      applicationId: card.applicationId,
      applicantName: card.applicantName,
      decision: card.decision,
      topNegativeFactors: card.topNegativeFactors,
    },
  };
}
