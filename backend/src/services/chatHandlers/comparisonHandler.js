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

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
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

function computePriorityScore(card) {
  const credit = clamp((numOrNull(card?.creditScore) ?? 600) / 850, 0, 1);
  const pd = clamp(numOrNull(card?.probabilityOfDefault) ?? 0.45, 0, 1);
  const completeness = clamp(
    numOrNull(card?.alternateUnderwriting?.dataCompletenessScore) ?? 0.6,
    0,
    1
  );
  const fraud = clamp(
    numOrNull(card?.alternateUnderwriting?.explanationMetadata?.fraudRiskScore) ??
      0.25,
    0,
    1
  );
  const manualPenalty = card?.manualReviewRequired ? 0.06 : 0;
  const requestedAmount = numOrNull(card?.requestedAmount) ?? 0;
  const monthlyIncome =
    numOrNull(card?.monthlyIncome) ??
    numOrNull(card?.householdMonthlyIncome) ??
    0;
  const affordabilityPenalty =
    monthlyIncome > 0
      ? clamp(requestedAmount / Math.max(1, monthlyIncome * 24), 0, 1) * 0.12
      : clamp(requestedAmount / 500000, 0, 1) * 0.08;
  const score = clamp(
    credit * 0.45 + (1 - pd) * 0.35 + completeness * 0.15 - fraud * 0.2 - manualPenalty,
    0,
    1
  );
  return Number(((score - affordabilityPenalty) * 100).toFixed(1));
}

function choosePrimaryConcern(card) {
  if (!Array.isArray(card?.topNegativeFactors) || !card.topNegativeFactors.length) {
    return null;
  }
  const nonMl = card.topNegativeFactors.find(
    (item) =>
      !String(item).includes("ml_inference_failed") &&
      !String(item).includes("Model fallback used")
  );
  return nonMl || card.topNegativeFactors[0];
}

function computeTieBreaker(cardA, cardB) {
  const aReq = numOrNull(cardA?.requestedAmount) ?? 0;
  const bReq = numOrNull(cardB?.requestedAmount) ?? 0;
  if (aReq !== bReq) return aReq < bReq ? "A" : "B";
  const aPd = numOrNull(cardA?.probabilityOfDefault) ?? 0.5;
  const bPd = numOrNull(cardB?.probabilityOfDefault) ?? 0.5;
  if (aPd !== bPd) return aPd < bPd ? "A" : "B";
  return "A";
}

function sanitizePriority(v) {
  if (!Number.isFinite(v)) return 0;
  return Number(Math.max(0, v).toFixed(1));
}

function computePriorityOrder(cardA, cardB) {
  const prA = sanitizePriority(computePriorityScore(cardA));
  const prB = sanitizePriority(computePriorityScore(cardB));
  if (prA === prB) {
    const winner = computeTieBreaker(cardA, cardB);
    return {
      prA,
      prB,
      first: winner,
      second: winner === "A" ? "B" : "A",
      tieBreakUsed: true,
    };
  }
  return {
    prA,
    prB,
    first: prA > prB ? "A" : "B",
    second: prA > prB ? "B" : "A",
    tieBreakUsed: false,
  };
}

function makeReasons(card, label) {
  const reasons = [];
  if (card?.riskLevel) reasons.push(`${label}: risk=${card.riskLevel}`);
  if (card?.probabilityOfDefault != null) {
    reasons.push(`${label}: PD=${fmtPct(card.probabilityOfDefault)}`);
  }
  const fraud = card?.alternateUnderwriting?.explanationMetadata?.fraudRiskScore;
  if (fraud != null) reasons.push(`${label}: fraud=${Math.round(fraud * 100)}%`);
  const complete = card?.alternateUnderwriting?.dataCompletenessScore;
  if (complete != null) reasons.push(`${label}: completeness=${Math.round(complete * 100)}%`);
  const concern = choosePrimaryConcern(card);
  if (concern) {
    reasons.push(`${label}: concern=${concern}`);
  }
  const requested = numOrNull(card?.requestedAmount);
  if (requested != null) {
    reasons.push(`${label}: requested=${fmtNum(requested, "₹")}`);
  }
  return reasons;
}

function buildStructuredComparisonAnswer(cardA, cardB, aiNarrative = null) {
  const order = computePriorityOrder(cardA, cardB);
  const prA = order.prA;
  const prB = order.prB;
  const first = order.first;
  const second = order.second;

  const reasons = [
    ...makeReasons(cardA, "A"),
    ...makeReasons(cardB, "B"),
  ].slice(0, 8);

  const lines = [
    "## Priority Decision",
    `1) ${first} (higher priority)`,
    `2) ${second}`,
    ...(order.tieBreakUsed
      ? ["- Tie-break used: lower requested amount preferred under equal risk profile"]
      : []),
    "",
    "## Side-by-Side Metrics",
    "| Metric | Application A | Application B |",
    "| :--- | :--- | :--- |",
    `| **Applicant** | ${cardA.applicantName || "N/A"} | ${cardB.applicantName || "N/A"} |`,
    `| **Req. Amount** | ${fmtNum(cardA.requestedAmount, "₹")} | ${fmtNum(cardB.requestedAmount, "₹")} |`,
    `| **Credit Score** | ${cardA.creditScore ?? "N/A"} | ${cardB.creditScore ?? "N/A"} |`,
    `| **Risk Level** | ${cardA.riskLevel ?? "N/A"} | ${cardB.riskLevel ?? "N/A"} |`,
    `| **Prob. Default** | ${fmtPct(cardA.probabilityOfDefault)} | ${fmtPct(cardB.probabilityOfDefault)} |`,
    `| **Priority Score** | ${prA} | ${prB} |`,
    "",
    "## Why",
    ...reasons.map((r) => `- ${r}`),
    "",
    "## Recommendation",
    `- A: ${cardA.decision || "review"}`,
    `- B: ${cardB.decision || "review"}`,
  ];

  if (aiNarrative && aiNarrative.trim()) {
    lines.push("", "## AI Summary", aiNarrative.trim());
  }
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

  let aiNarrative = "";
  try {
    aiNarrative = await askGroundedCopilot({
      question:
        `${question}\n\nRespond in max 8 lines. Focus only on: priority winner, top 3 reasons, and final recommendation for A and B.`,
      context,
      intent: "comparison",
    });
  } catch (err) {
    // Graceful fallback: keep deterministic summary without blocking user.
    if (err.isOllamaUnavailable) {
      aiNarrative = "[AI narrative unavailable — Ollama not reachable]";
    } else {
      aiNarrative = `[AI narrative unavailable — ${err.message}]`;
    }
  }

  const answer = buildStructuredComparisonAnswer(cardA, cardB, aiNarrative);

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
