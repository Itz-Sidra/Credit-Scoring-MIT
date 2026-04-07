/**
 * Analytics Handler  (Phase 5 — Chat Handlers)
 * Intent: aggregate_insight
 *
 * Answers portfolio-level admin questions using MongoDB aggregation pipelines.
 * No LLM required — the answer is always derived from real data.
 *
 * Supported query patterns (detected via heuristics on the routed entities):
 *  - Counts by decision (approved / rejected / hold / review)
 *  - Counts by riskLevel
 *  - Counts by borrowerType / segment
 *  - On-hold applications broken down by reason keywords
 *  - AML flagged application counts
 *  - Average credit score by borrowerType
 *  - Total applications (catch-all)
 *  - On-hold due to identity issues
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Uses LoanApplication model directly (read-only aggregate queries).
 *  - Does NOT modify any document.
 *  - No existing controller/service modified.
 */

import LoanApplication from "../../models/LoanApplication.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Formats an aggregation result array ([ { _id, count } ]) into readable lines.
 */
function formatCountResult(results, label = "Category") {
  if (!results.length) return `No data found.`;
  return results
    .map((r) => `  ${r._id ?? "unknown"}: ${r.count}`)
    .join("\n");
}

function total(results) {
  return results.reduce((sum, r) => sum + (r.count || 0), 0);
}

// ── Query dispatcher ──────────────────────────────────────────────────────────

/**
 * Determines which analytics sub-query to run based on the normalised query
 * text and extracted entities from the Phase 4 router.
 */
async function dispatchAnalytics(normalizedQuery, entities = {}) {
  const q = normalizedQuery || "";

  // ── 1. Identity / KYC hold question ──────────────────────────────────────
  const identityKeywords = /\b(identity|kyc|document|verification|docs|id check)\b/i;
  if (
    /\b(hold|on.hold|pending|under review)\b/i.test(q) &&
    identityKeywords.test(q)
  ) {
    return runIdentityHoldCount();
  }

  // ── 2. AML flagged ────────────────────────────────────────────────────────
  if (/\baml\b|compliance flag|fraud flag/i.test(q)) {
    return runAmlFlagCount();
  }

  // ── 3. Average credit score by borrower type ──────────────────────────────
  if (/\b(average|avg)\b.*\bcredit(?: score)?\b|credit score.*\b(average|avg)\b/i.test(q)) {
    return runAvgCreditScore();
  }

  // ── 4. By borrower segment ────────────────────────────────────────────────
  if (
    /\b(salaried|farmer|msme|self.employed|business|gig worker|freelancer|student)\b/i.test(q) &&
    /\b(count|how many|total|number)\b/i.test(q)
  ) {
    const segment = (entities.borrowerSegment || "").toLowerCase() || null;
    return runByBorrowerType(segment);
  }

  // ── 5. By risk level ──────────────────────────────────────────────────────
  if (/\brisk\b/i.test(q) && /\b(count|how many|total|number|breakdown|distribution)\b/i.test(q)) {
    const riskLevel = entities.riskLevel
      ? entities.riskLevel.replace(" risk", "")
      : null;
    return runByRiskLevel(riskLevel);
  }

  // ── 6. Rejection reasons ──────────────────────────────────────────────────
  if (/\b(rejection|rejected|reject)\b.*\b(reason|why|cause)\b|top rejection/i.test(q)) {
    return runRejectionReasons(entities.borrowerSegment);
  }

  // ── 7. By decision ────────────────────────────────────────────────────────
  if (
    /\b(approved|rejected|hold|pending|under review|review)\b/i.test(q) &&
    /\b(count|how many|total|number)\b/i.test(q)
  ) {
    return runByDecision();
  }

  // ── 8. General hold breakdown ───────────────────────────────────────────
  if (/\b(on.hold|hold)\b/i.test(q)) {
    return runByStatus("hold");
  }

  // ── 9. Portfolio summary (catch-all) ──────────────────────────────────────
  return runPortfolioSummary();
}

// ── Aggregation functions ─────────────────────────────────────────────────────

async function runPortfolioSummary() {
  const [byDecision, byRisk, total_] = await Promise.all([
    LoanApplication.aggregate([
      { $group: { _id: "$features.decision", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    LoanApplication.aggregate([
      { $group: { _id: "$aiAnalysis.riskLevel", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    LoanApplication.countDocuments({}),
  ]);

  const lines = [
    `Total applications: ${total_}`,
    "",
    "By decision:",
    formatCountResult(byDecision),
    "",
    "By risk level:",
    formatCountResult(byRisk),
  ];

  return {
    answer: lines.join("\n"),
    metadata: { type: "portfolio_summary", total: total_, byDecision, byRisk },
  };
}

async function runByDecision() {
  const results = await LoanApplication.aggregate([
    { $group: { _id: { $ifNull: ["$features.decision", "unknown"] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const t = total(results);
  return {
    answer: `Applications by decision (total: ${t}):\n${formatCountResult(results)}`,
    metadata: { type: "by_decision", total: t, results },
  };
}

async function runByRiskLevel(filterLevel = null) {
  const match = filterLevel
    ? { $match: { "aiAnalysis.riskLevel": new RegExp(filterLevel, "i") } }
    : { $match: {} };

  const results = await LoanApplication.aggregate([
    match,
    { $group: { _id: { $ifNull: ["$aiAnalysis.riskLevel", "unknown"] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const t = total(results);
  const label = filterLevel ? `"${filterLevel}" risk` : "all risk levels";
  return {
    answer: `Applications by risk level (${label}, total: ${t}):\n${formatCountResult(results)}`,
    metadata: { type: "by_risk_level", filterLevel, total: t, results },
  };
}

async function runByBorrowerType(filterSegment = null) {
  const match = filterSegment
    ? { $match: { "features.borrowerType": new RegExp(filterSegment, "i") } }
    : { $match: {} };

  const results = await LoanApplication.aggregate([
    match,
    { $group: { _id: { $ifNull: ["$features.borrowerType", "unknown"] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const t = total(results);
  const label = filterSegment ? `"${filterSegment}"` : "all segments";
  return {
    answer: `Applications by borrower type (${label}, total: ${t}):\n${formatCountResult(results)}`,
    metadata: { type: "by_borrower_type", filterSegment, total: t, results },
  };
}

async function runIdentityHoldCount() {
  const results = await LoanApplication.aggregate([
    {
      $match: {
        $or: [
          { status: "hold" },
          { "features.preScreenStatus": "hold" },
          { "features.decision": "hold" },
        ],
        $or: [
          { "features.decisionReason": /identity|kyc|document/i },
          { "aiAnalysis.amlFlags": /identity|kyc/i },
          { "features.preScreenStatus": "identity_check_failed" },
        ],
      },
    },
    { $count: "count" },
  ]);

  const count = results[0]?.count ?? 0;
  return {
    answer: `Applications currently on hold due to identity / KYC document issues: ${count}`,
    metadata: { type: "identity_hold_count", count },
  };
}

async function runAmlFlagCount() {
  const results = await LoanApplication.aggregate([
    { $match: { "aiAnalysis.amlFlags": { $exists: true, $not: { $size: 0 } } } },
    { $group: { _id: "$aiAnalysis.amlFlags", count: { $sum: 1 } } },
  ]);

  // Flatten individual flags
  const flagMap = {};
  results.forEach((r) => {
    (r._id || []).forEach((flag) => {
      flagMap[flag] = (flagMap[flag] || 0) + r.count;
    });
  });

  const sorted = Object.entries(flagMap)
    .sort((a, b) => b[1] - a[1])
    .map(([flag, count]) => `  ${flag}: ${count}`);

  const totalFlagged = await LoanApplication.countDocuments({
    "aiAnalysis.amlFlags": { $exists: true, $not: { $size: 0 } },
  });

  if (!sorted.length) {
    return {
      answer: "No AML-flagged applications found in the database.",
      metadata: { type: "aml_flags", total: 0 },
    };
  }

  return {
    answer: `Applications with AML/compliance flags — total: ${totalFlagged}\nBreakdown by flag type:\n${sorted.join("\n")}`,
    metadata: { type: "aml_flags", total: totalFlagged, flagMap },
  };
}

async function runAvgCreditScore() {
  const results = await LoanApplication.aggregate([
    { $match: { "aiAnalysis.creditScore": { $gt: 0 } } },
    {
      $group: {
        _id: { $ifNull: ["$features.borrowerType", "unknown"] },
        avgScore: { $avg: "$aiAnalysis.creditScore" },
        count: { $sum: 1 },
      },
    },
    { $sort: { avgScore: -1 } },
  ]);

  if (!results.length) {
    return {
      answer: "No credit score data available.",
      metadata: { type: "avg_credit_score" },
    };
  }

  const lines = results.map(
    (r) => `  ${r._id}: avg ${Math.round(r.avgScore)} (${r.count} applicants)`
  );

  return {
    answer: `Average credit score by borrower type:\n${lines.join("\n")}`,
    metadata: { type: "avg_credit_score", results },
  };
}

async function runRejectionReasons(borrowerSegment = null) {
  const match = { "features.decision": "reject" };
  if (borrowerSegment) {
    match["features.borrowerType"] = new RegExp(borrowerSegment, "i");
  }

  const results = await LoanApplication.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ["$features.decisionReason", "no reason recorded"] },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  const t = total(results);
  const segLabel = borrowerSegment ? ` for ${borrowerSegment} applicants` : "";

  if (!results.length) {
    return {
      answer: `No rejection reason data found${segLabel}.`,
      metadata: { type: "rejection_reasons" },
    };
  }

  return {
    answer: `Top rejection reasons${segLabel} (of ${t} rejected):\n${formatCountResult(results)}`,
    metadata: { type: "rejection_reasons", borrowerSegment, total: t, results },
  };
}

async function runByStatus(status) {
  const count = await LoanApplication.countDocuments({ status });
  return {
    answer: `Applications with status "${status}": ${count}`,
    metadata: { type: "by_status", status, count },
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * @param {string|null} _applicationId  - not used for aggregate queries
 * @param {object}      routedQuery     - from Phase 4 routeQuery()
 * @returns {object} standardised handler response
 */
export async function analyticsHandler(_applicationId, routedQuery) {
  const normalizedQuery = routedQuery?.normalizedQuery || "";
  const entities        = routedQuery?.entities || {};

  let result;
  try {
    result = await dispatchAnalytics(normalizedQuery, entities);
  } catch (err) {
    return {
      intent: "aggregate_insight",
      answer: `Analytics query failed: ${err.message}. Please ensure the database is reachable.`,
      sources: [],
      contextType: "portfolio_analytics",
      metadata: { error: err.message },
    };
  }

  return {
    intent: "aggregate_insight",
    answer: result.answer,
    sources: [],
    contextType: "portfolio_analytics",
    metadata: result.metadata,
  };
}
