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

  let answer;
  try {
    answer = await askGroundedCopilot({ question, context, intent: "risk_explanation" });
  } catch (err) {
    if (err.isOllamaUnavailable) {
      // Graceful fallback: return a short plain-English summary without LLM prose
      const parts = [];

      const riskLevel = card.riskLevel ?? "not recorded";
      const decision = card.decision ?? "not recorded";
      const pd =
        card.probabilityOfDefault != null
          ? `${(card.probabilityOfDefault * 100).toFixed(1)}%`
          : "not available";
      const preScreen = card.preScreenStatus ?? "not recorded";

      parts.push(
        `This application has a risk level of ${riskLevel} and the decision is "${decision}". ` +
          `The model-estimated probability of default is ${pd}, and the pre-screen status is ${preScreen}.`
      );

      if (card.topNegativeFactors?.length) {
        parts.push(
          `Key concerns include: ${card.topNegativeFactors.join("; ")}.`
        );
      }

      if (card.decisionReason) {
        parts.push(`Decision reason: ${card.decisionReason}.`);
      }

      parts.push(
        "Detailed AI reasoning is not available right now because the analysis engine (Ollama) is not reachable."
      );

      answer = parts.join(" ");
    } else {
      answer = `Risk analysis unavailable: ${err.message}`;
    }
  }

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
