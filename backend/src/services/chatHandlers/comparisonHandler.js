/**
 * Comparison Handler  (Phase 5 — Chat Handlers)
 * Intent: comparison
 *
 * Fetches two ApplicantCards and produces a structured side-by-side comparison.
 * Qwen is used optionally to produce a plain-English summary paragraph.
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Only calls Phase 2 fetch + Phase 3 Ollama services.
 *  - No existing file modified.
 */

import { getApplicantCardByApplicationId } from "../applicantFetchService.js";
import { askGroundedCopilot }              from "../ollamaService.js";
import LoanApplication                      from "../../models/LoanApplication.js";

// ── Context builder ───────────────────────────────────────────────────────────

function fmtNum(v, prefix = "", suffix = "") {
  if (v === null || v === undefined) return "N/A";
  return `${prefix}${Number(v).toLocaleString("en-IN")}${suffix}`;
}

function fmtBool(v) {
  if (v === null || v === undefined) return "N/A";
  return v ? "Yes" : "No";
}

function fmtPct(v) {
  if (v === null || v === undefined) return "N/A";
  return `${(v * 100).toFixed(1)}%`;
}

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const LOAN_CODE_RE = /^[a-z]\d{1,8}$/i;

async function resolveToApplicationId(rawId) {
  if (!rawId || typeof rawId !== "string") return null;
  const candidate = rawId.trim();

  if (OBJECT_ID_RE.test(candidate)) {
    return candidate;
  }

  if (LOAN_CODE_RE.test(candidate)) {
    const loan = await LoanApplication.findOne({ loanCode: candidate.toUpperCase() })
      .select("_id")
      .lean();
    return loan?._id?.toString() || null;
  }

  return candidate;
}

/**
 * Builds a side-by-side comparison context string from two ApplicantCards.
 */
function buildComparisonContext(cardA, cardB) {
  const lines = [];

  const row = (label, a, b) => {
    lines.push(`${label}:`);
    lines.push(`  A (${cardA.applicationId}): ${a}`);
    lines.push(`  B (${cardB.applicationId}): ${b}`);
  };

  lines.push("=== Comparison: Two Applications ===");
  row("Applicant",          cardA.applicantName,   cardB.applicantName);
  row("Loan Type",          cardA.loanType ?? "N/A",   cardB.loanType ?? "N/A");
  row("Requested Amount",   fmtNum(cardA.requestedAmount, "₹"), fmtNum(cardB.requestedAmount, "₹"));
  row("Eligible Amount",    fmtNum(cardA.eligibleAmount, "₹"),  fmtNum(cardB.eligibleAmount, "₹"));
  row("Status",             cardA.status ?? "N/A",  cardB.status ?? "N/A");
  row("Decision",           cardA.decision ?? "N/A", cardB.decision ?? "N/A");

  lines.push("\n=== Risk & Scoring ===");
  row("Risk Level",         cardA.riskLevel ?? "N/A",  cardB.riskLevel ?? "N/A");
  row("Probability of Default", fmtPct(cardA.probabilityOfDefault), fmtPct(cardB.probabilityOfDefault));
  row("Pre-Screen Status",  cardA.preScreenStatus ?? "N/A",  cardB.preScreenStatus ?? "N/A");
  row("Credit Score",       cardA.creditScore ?? "N/A",      cardB.creditScore ?? "N/A");

  lines.push("\n=== Income & Repayment ===");
  row("Monthly Income",     fmtNum(cardA.monthlyIncome, "₹"),  fmtNum(cardB.monthlyIncome, "₹"));
  row("Existing EMI Burden",fmtNum(cardA.totalExistingEmiBurden, "₹"), fmtNum(cardB.totalExistingEmiBurden, "₹"));
  row("Borrower Type",      cardA.borrowerType ?? "N/A", cardB.borrowerType ?? "N/A");

  lines.push("\n=== Verification ===");
  row("Docs Verified",      fmtBool(cardA.docsVerified),     fmtBool(cardB.docsVerified));
  row("Identity Verified",  fmtBool(cardA.identityVerified), fmtBool(cardB.identityVerified));
  row("Bank Account",       fmtBool(cardA.hasBankAccount),   fmtBool(cardB.hasBankAccount));
  row("UPI History",        fmtBool(cardA.hasUpiHistory),    fmtBool(cardB.hasUpiHistory));

  lines.push("\n=== Key Concerns ===");
  lines.push(`A — Top Concerns: ${cardA.topNegativeFactors?.join("; ") || "none"}`);
  lines.push(`B — Top Concerns: ${cardB.topNegativeFactors?.join("; ") || "none"}`);

  lines.push("\n=== Key Strengths ===");
  lines.push(`A — Strengths: ${cardA.topPositiveFactors?.join("; ") || "none"}`);
  lines.push(`B — Strengths: ${cardB.topPositiveFactors?.join("; ") || "none"}`);

  return lines.join("\n");
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * @param {string|null} applicationId  - first ID (from routedQuery.applicationId)
 * @param {object}      routedQuery    - from Phase 4 routeQuery()
 * @returns {object} standardised handler response
 */
export async function comparisonHandler(applicationId, routedQuery) {
  const idA = applicationId || routedQuery?.entities?.applicationIdA || null;
  const idB = routedQuery?.entities?.applicationIdB || null;

  if (!idA || !idB) {
    return {
      intent: "comparison",
      answer:
        "Comparison requires two application IDs. " +
        "Please specify both — for example: 'Compare application <id1> and <id2>'.",
      sources: [],
      contextType: "unsupported",
      metadata: { reason: "missing_second_id", idA, idB },
    };
  }

  // Resolve incoming identifiers (ObjectId or loanCode) into application IDs
  let resolvedIdA, resolvedIdB;
  try {
    [resolvedIdA, resolvedIdB] = await Promise.all([
      resolveToApplicationId(idA),
      resolveToApplicationId(idB),
    ]);
  } catch (err) {
    return {
      intent: "comparison",
      answer: `Unable to resolve application identifiers for comparison: ${err.message}`,
      sources: [],
      contextType: "unsupported",
      metadata: { error: err.message, idA, idB },
    };
  }

  if (!resolvedIdA || !resolvedIdB) {
    return {
      intent: "comparison",
      answer:
        "Could not resolve one or both application references. " +
        "Please verify the IDs or loan codes and try again.",
      sources: [],
      contextType: "unsupported",
      metadata: { reason: "unresolved_identifiers", idA, idB, resolvedIdA, resolvedIdB },
    };
  }

  // Fetch both cards in parallel
  let cardA, cardB;
  try {
    [cardA, cardB] = await Promise.all([
      getApplicantCardByApplicationId(resolvedIdA),
      getApplicantCardByApplicationId(resolvedIdB),
    ]);
  } catch (err) {
    return {
      intent: "comparison",
      answer: `Unable to fetch applications for comparison: ${err.message}`,
      sources: [],
      contextType: "unsupported",
      metadata: { error: err.message },
    };
  }

  if (!cardA) {
    return {
      intent: "comparison",
      answer: `Application ${idA} was not found. Please verify the ID/loan code.`,
      sources: [idA],
      contextType: "unsupported",
      metadata: { missingId: idA },
    };
  }
  if (!cardB) {
    return {
      intent: "comparison",
      answer: `Application ${idB} was not found. Please verify the ID/loan code.`,
      sources: [idB],
      contextType: "unsupported",
      metadata: { missingId: idB },
    };
  }

  const context  = buildComparisonContext(cardA, cardB);
  const question =
    routedQuery?.normalizedQuery ||
    "Provide a clear, factual comparison of these two applications. Highlight the key differences in risk, income, verification, and the likely reasons for their respective decisions.";

  let answer;
  try {
    answer = await askGroundedCopilot({ question, context, intent: "comparison" });
  } catch (err) {
    // Graceful fallback: return the structured comparison table
    if (err.isOllamaUnavailable) {
      answer = context + "\n\n[AI narrative summary unavailable — Ollama is not reachable]";
    } else {
      answer = `Comparison analysis unavailable: ${err.message}\n\n` + context;
    }
  }

  return {
    intent: "comparison",
    answer,
    sources: [cardA.applicationId, cardB.applicationId],
    contextType: "comparison",
    metadata: {
      applicationIdA: cardA.applicationId,
      applicationIdB: cardB.applicationId,
      applicantA: cardA.applicantName,
      applicantB: cardB.applicantName,
      decisionA: cardA.decision,
      decisionB: cardB.decision,
      riskLevelA: cardA.riskLevel,
      riskLevelB: cardB.riskLevel,
    },
  };
}
