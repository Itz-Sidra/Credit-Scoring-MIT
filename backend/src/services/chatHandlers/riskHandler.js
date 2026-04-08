/**
 * Risk Handler  (Phase 5 — Chat Handlers)
 * Intent: risk_explanation
 *
 * Fetches an ApplicantCard, extracts risk-relevant context, and asks the
 * Phase 3 grounded Qwen engine to explain the risk/hold/rejection decision.
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Only calls Phase 2 fetch + Phase 3 Ollama services.
 *  - No existing file modified.
 */

import { getApplicantCardByApplicationId } from "../applicantFetchService.js";
import { askGroundedCopilot }              from "../ollamaService.js";

function fmtPct(v) {
  if (v === null || v === undefined) return "N/A";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtInr(v) {
  if (v === null || v === undefined) return "N/A";
  return `₹${Number(v).toLocaleString("en-IN")}`;
}

// ── Context builder ───────────────────────────────────────────────────────────

/**
 * Extracts only the risk-relevant fields from an ApplicantCard and returns
 * a lean context string for injection into the prompt.
 */
function buildRiskContext(card) {
  const lines = [];

  const row = (label, value) => {
    if (value === null || value === undefined) return;
    if (typeof value === "boolean") {
      lines.push(`${label}: ${value ? "Yes" : "No"}`);
      return;
    }
    lines.push(`${label}: ${value}`);
  };

  lines.push("=== Application ===");
  row("Application ID",           card.applicationId);
  row("Loan Type",                card.loanType);
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
  row("Status",                   card.status);

  lines.push("\n=== Decision & Risk ===");
  row("Decision",                 card.decision);
  row("Risk Level",               card.riskLevel);
  row("Probability of Default",
    card.probabilityOfDefault != null
      ? `${(card.probabilityOfDefault * 100).toFixed(1)}%`
      : null
  );
  row("Pre-Screen Status",        card.preScreenStatus);
  row("Manual Review Required",   card.manualReviewRequired);
  row("Decision Reason",          card.decisionReason);

  if (card.amlFlags?.length) {
    lines.push(`AML / Compliance Flags: ${card.amlFlags.join(", ")}`);
  }

  lines.push("\n=== Risk Factors ===");
  if (card.topNegativeFactors?.length) {
    lines.push(`Top Concerns: ${card.topNegativeFactors.join("; ")}`);
  }
  if (card.topPositiveFactors?.length) {
    lines.push(`Mitigating Strengths: ${card.topPositiveFactors.join("; ")}`);
  }
  if (card.shapExplanation?.length) {
    lines.push(`Model Explanation: ${card.shapExplanation.join("; ")}`);
  }

  lines.push("\n=== Applicant Profile ===");
  row("Borrower Type",            card.borrowerType);
  row("Credit Score",             card.creditScore);
  row("Monthly Income",
    card.monthlyIncome != null
      ? `₹${Number(card.monthlyIncome).toLocaleString("en-IN")}`
      : null
  );
  row("Existing EMI Burden",
    card.totalExistingEmiBurden != null
      ? `₹${Number(card.totalExistingEmiBurden).toLocaleString("en-IN")}`
      : null
  );
  row("Docs Verified",            card.docsVerified);
  row("Identity Verified",        card.identityVerified);

  return lines.join("\n");
}

function buildStructuredRiskAnswer(card, aiSummary = "") {
  const lines = [
    "## Risk Snapshot",
    `- Applicant: ${card.applicantName || "N/A"}`,
    `- Application: ${card.applicationId || "N/A"}`,
    `- Loan Type: ${card.loanType || "N/A"}`,
    `- Requested Amount: ${fmtInr(card.requestedAmount)}`,
    `- Eligible Amount: ${fmtInr(card.eligibleAmount)}`,
    "",
    "## Decision Signals",
    `- Decision: ${card.decision || "N/A"}`,
    `- Status: ${card.status || "N/A"}`,
    `- Risk Level: ${card.riskLevel || "N/A"}`,
    `- Credit Score: ${card.creditScore ?? "N/A"}`,
    `- Probability of Default: ${fmtPct(card.probabilityOfDefault)}`,
    `- Pre-screen: ${card.preScreenStatus || "N/A"}`,
    "",
    "## Key Concerns",
    ...(card.topNegativeFactors?.length
      ? card.topNegativeFactors.slice(0, 4).map((x) => `- ${x}`)
      : ["- No major negative factors recorded"]),
    "",
    "## Mitigating Factors",
    ...(card.topPositiveFactors?.length
      ? card.topPositiveFactors.slice(0, 4).map((x) => `- ${x}`)
      : ["- No major positive factors recorded"]),
  ];

  if (aiSummary && aiSummary.trim()) {
    lines.push("", "## AI Summary", aiSummary.trim());
  }
  return lines.join("\n");
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * @param {string|null} applicationId
 * @param {object} routedQuery
 * @returns {object} standardised handler response
 */
export async function riskHandler(applicationId, routedQuery) {
  if (!applicationId) {
    return {
      intent: "risk_explanation",
      answer:
        "To explain a risk or hold decision, please provide the application ID. " +
        "Example: 'Why was application 69c7c8d1457f8adf69e556dd put on hold?'",
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
      intent: "risk_explanation",
      answer: `Unable to fetch application: ${err.message}`,
      sources: [],
      contextType: "unsupported",
      metadata: { error: err.message },
    };
  }

  if (!card) {
    return {
      intent: "risk_explanation",
      answer: `No application found with ID ${applicationId}.`,
      sources: [applicationId],
      contextType: "unsupported",
      metadata: { applicationId, reason: "not_found" },
    };
  }

  const context = buildRiskContext(card);
  const question = routedQuery?.normalizedQuery || "Explain the risk assessment and decision for this application.";

  let aiSummary = "";
  try {
    aiSummary = await askGroundedCopilot({
      question:
        `${question}\n\nRespond in max 6 lines. Include: core risk reason, approval/review recommendation, and one caution.`,
      context,
      intent: "risk_explanation",
    });
  } catch (err) {
    aiSummary = err.isOllamaUnavailable
      ? "[AI narrative unavailable - Ollama not reachable]"
      : `[AI narrative unavailable - ${err.message}]`;
  }
  const answer = buildStructuredRiskAnswer(card, aiSummary);

  return {
    intent: "risk_explanation",
    answer,
    sources: [card.applicationId],
    contextType: "applicant_card",
    metadata: {
      applicationId: card.applicationId,
      applicantName: card.applicantName,
      riskLevel: card.riskLevel,
      decision: card.decision,
      probabilityOfDefault: card.probabilityOfDefault,
    },
  };
}
