/**
 * Query Router Service  (Phase 4 — Intent Detection)
 *
 * Classifies an incoming admin question into a structured routing decision.
 * Uses deterministic regex + keyword heuristics only — no ML, no embeddings,
 * no external calls.
 *
 * Public API:
 *   routeQuery(query, options?)  →  RouteResult
 *
 * RouteResult shape:
 * {
 *   intent:          string,       // one of INTENTS
 *   applicationId:   string|null,  // extracted 24-hex Mongo ObjectId if present
 *   entities:        object,       // lightweight extracted entities
 *   normalizedQuery: string,       // lower-cased, trimmed query
 *   confidence:      "high"|"medium"|"low"
 * }
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Pure function — no DB, no LLM, no HTTP, no side effects.
 *  - No existing file modified.
 */

// ── Intent constants ──────────────────────────────────────────────────────────
export const INTENTS = {
  APPLICANT_LOOKUP:       "applicant_lookup",
  RISK_EXPLANATION:       "risk_explanation",
  IMPROVEMENT_SUGGESTION: "improvement_suggestion",
  COMPARISON:             "comparison",
  SIMILAR_APPLICANTS:     "similar_applicants",
  AGGREGATE_INSIGHT:      "aggregate_insight",
  UNSUPPORTED_QUERY:      "unsupported_query",
};

// ── Mongo ObjectId pattern: exactly 24 hex characters ────────────────────────
const OBJECT_ID_RE = /\b([a-f0-9]{24})\b/i;

// ── Borrower segment labels ───────────────────────────────────────────────────
const BORROWER_SEGMENTS = [
  "salaried", "salary", "farmer", "msme", "self-employed", "self employed",
  "business owner", "student", "pensioner", "gig worker", "freelancer",
  "informal worker",
];

// ── Risk level labels ─────────────────────────────────────────────────────────
const RISK_LABELS = ["low risk", "medium risk", "high risk", "low-risk", "high-risk", "medium-risk"];

// ── Rejection / hold reasons ──────────────────────────────────────────────────
const REASON_PHRASES = [
  "identity issues", "identity verification", "kyc",
  "income insufficient", "low income", "income issues",
  "high emi", "emi burden", "existing debt",
  "no bank account", "no banking history", "no upi",
  "aml flag", "compliance flag", "fraud flag",
  "low credit score", "poor credit",
  "no collateral", "insufficient collateral",
  "pre-screen failure", "pre screen",
  "documentation", "docs not verified", "document issues",
];

// ──────────────────────────────────────────────────────────────────────────────
// Intent rule definitions
// Each rule has a `test(q)` predicate and an optional `confidence`.
// Rules are evaluated in priority order — first match wins.
// ──────────────────────────────────────────────────────────────────────────────

const INTENT_RULES = [
  // ── 1. comparison — must come BEFORE applicant_lookup so two-ID compare wins
  {
    intent: INTENTS.COMPARISON,
    confidence: "high",
    test: (q) =>
      /\b(compar(e|ing|ison)|versus|vs\.?|side.by.side)\b/.test(q),
  },

  // ── 2. similar_applicants ─────────────────────────────────────────────────
  {
    intent: INTENTS.SIMILAR_APPLICANTS,
    confidence: "high",
    test: (q) =>
      /\b(similar|like this|like these|like them|alike|resemble|same profile)\b/.test(q) ||
      /\b(find (other |more |similar )?applicants|show (other |more |similar )?(cases|applicants|borrowers|profiles))\b/.test(q),
  },

  // ── 3. improvement_suggestion — BEFORE applicant_lookup so semantic intent
  //    wins even when the query also contains an application ID
  {
    intent: INTENTS.IMPROVEMENT_SUGGESTION,
    confidence: "high",
    test: (q) =>
      /\b(improve|improvement|fix|what (can|should|could|must|needs? to)|how (can|should|could|do|does)|qualify|get approved|increase (their |the )?(chance|eligib|score|limit)|steps? to|tips? for|advice for|recommend)\b/.test(q) &&
      /\b(applicant|they|them|this|loan|application|borrower|candidate|score|person)\b/.test(q),
  },

  // ── 4. risk_explanation — BEFORE applicant_lookup for the same reason
  {
    intent: INTENTS.RISK_EXPLANATION,
    confidence: "high",
    test: (q) =>
      /\b(why|reason|explain|what caused|what is (the )?reason|basis|rationale|justif|what does (it|this|the) mean|how (was|is|did))\b/.test(q) &&
      /\b(hold|reject(ed)?|approv(e|ed|al)|risk|high risk|low risk|score|decision|on hold|under review|declined|eligible amount|amount lower|less(er)? amount|difference)\b/.test(q),
  },

  // ── 4b. Applicant profile facts (income, employment, business type, etc.)
  //    Queries like "For P1 what is their income?" failed routing because they
  //    are neither risk questions nor "show/get applicant" phrasing, and the
  //    catch-all excludes any query that mentions credit-domain words — leaving
  //    no matching rule. Route these to applicant_lookup (summary includes income & occupation).
  {
    intent: INTENTS.APPLICANT_LOOKUP,
    confidence: "high",
    test: (q) => {
      const asksFact =
        /\b(what(\s+is|\s+are|\s+was)?|whats|how much|tell me|show me|give me|do they|are they|is (he|she|they|the applicant))\b/.test(q);
      const topicIncomeOrWork =
        /\b(income|salary|earn|earning|earnings|revenue|turnover|monthly pay|take[\s-]?home|occupation|employment|job|employer|business owner|business type|self[- ]employ|borrower type|applicant type|salaried|msme|farmer|gig|freelance)\b/.test(q);
      const hasApplicationContext =
        /\b(application|applicant|loan|case|profile|borrower|customer)\b/.test(q) ||
        /\bp\d{1,8}\b/.test(q) ||
        OBJECT_ID_RE.test(q);
      return asksFact && topicIncomeOrWork && hasApplicationContext;
    },
  },

  // ── 5. applicant_lookup ───────────────────────────────────────────────────
  //    Only wins when no stronger semantic intent matched above.
  {
    intent: INTENTS.APPLICANT_LOOKUP,
    confidence: "high",
    test: (q) =>
      OBJECT_ID_RE.test(q) ||
      /\b(show|pull up|fetch|get|display|open|load|find|lookup|look up|give|provide|view|see|tell me|tell|explain|summarize|give info|info|details|what is|summary)\b/.test(q) &&
        /\b(application|applicant|case|record|profile|loan|details?|info(?:rmation)?|user|borrower|customer|client)\b/.test(q),
  },

  // ── 6. aggregate_insight ──────────────────────────────────────────────────
  {
    intent: INTENTS.AGGREGATE_INSIGHT,
    confidence: "high",
    test: (q) =>
      /\b(how many|count|total|average|avg|distribution|breakdown|percentage|ratio|trend|summary|portfolio|all applicants|across|top \d+|most common)\b/.test(q) ||
      /\b(top (rejection|approval|risk|reason)|rejection reason|approval rate)\b/.test(q),
  },

  // ── 7. Catch-all: unsupported_query ───────────────────────────────────────
  // This is the fallback for anything that clearly has no applicant/loan context.
  {
    intent: INTENTS.UNSUPPORTED_QUERY,
    confidence: "high",
    test: (q) => {
      const creditDomainWords = /\b(applicant|application|loan|credit|risk|reject|approv|hold|borrow|lend|emi|income|collateral|upi|bank|score|kcc|msme|farmer|salaried|identity|kyc|aml|default|probability|decision|eligible|disburse|tenure|interest)\b/;
      return !creditDomainWords.test(q);
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Entity extractors
// ──────────────────────────────────────────────────────────────────────────────

function extractApplicationId(q) {
  const match = q.match(OBJECT_ID_RE);
  return match ? match[1].toLowerCase() : null;
}

function extractReason(q) {
  for (const phrase of REASON_PHRASES) {
    if (q.includes(phrase)) return phrase;
  }
  // "due to X" / "because of X" / "related to X"
  const dueToMatch = q.match(/(?:due to|because of|related to|for)\s+([a-z][a-z\s]{2,30}?)(?:\?|$|,|\band\b|\bor\b)/);
  if (dueToMatch) return dueToMatch[1].trim();
  return null;
}

function extractBorrowerSegment(q) {
  for (const seg of BORROWER_SEGMENTS) {
    if (q.includes(seg)) return seg;
  }
  return null;
}

function extractRiskLevel(q) {
  for (const label of RISK_LABELS) {
    if (q.includes(label)) return label.replace("-", " ");
  }
  return null;
}

function extractLoanType(q) {
  const types = ["personal", "home", "auto", "education", "business", "credit card", "credit_card"];
  for (const t of types) {
    if (q.includes(t)) return t.replace(" ", "_");
  }
  return null;
}

function buildEntities(q, intent) {
  const entities = {};

  const reason   = extractReason(q);
  const segment  = extractBorrowerSegment(q);
  const riskLevel = extractRiskLevel(q);
  const loanType = extractLoanType(q);

  if (reason)    entities.reason         = reason;
  if (segment)   entities.borrowerSegment = segment;
  if (riskLevel) entities.riskLevel       = riskLevel;
  if (loanType)  entities.loanType        = loanType;

  // For comparison, try to extract two IDs
  if (intent === INTENTS.COMPARISON) {
    const allIds = [...q.matchAll(/\b([a-f0-9]{24})\b/gi)].map(m => m[1].toLowerCase());
    if (allIds.length >= 2) {
      entities.applicationIdA = allIds[0];
      entities.applicationIdB = allIds[1];
    } else {
      // Fallback: support human-readable loan codes like P45, H7, etc.
      const allLoanCodes = [...q.matchAll(/\b([a-z]\d{1,8})\b/gi)].map((m) => m[1].toUpperCase());
      if (allLoanCodes.length >= 2) {
        entities.applicationIdA = allLoanCodes[0];
        entities.applicationIdB = allLoanCodes[1];
      }
    }
  }

  return entities;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Route an admin query to the correct intent + extract entities.
 *
 * @param {string} query     - raw user input
 * @param {object} [options] - reserved for future use (e.g. { activeApplicationId })
 * @returns {{
 *   intent: string,
 *   applicationId: string|null,
 *   entities: object,
 *   normalizedQuery: string,
 *   confidence: string
 * }}
 */
export function routeQuery(query, options = {}) {
  if (!query || typeof query !== "string") {
    return {
      intent:          INTENTS.UNSUPPORTED_QUERY,
      applicationId:   null,
      entities:        {},
      normalizedQuery: "",
      confidence:      "high",
    };
  }

  const normalized = query.trim().toLowerCase();

  // Run intent rules in priority order
  let matched = null;
  for (const rule of INTENT_RULES) {
    if (rule.test(normalized)) {
      matched = rule;
      break;
    }
  }

  // If nothing matched (shouldn't happen given the catch-all), default to unsupported
  const intent     = matched?.intent     ?? INTENTS.UNSUPPORTED_QUERY;
  const confidence = matched?.confidence ?? "low";

  const applicationId = extractApplicationId(normalized);
  const entities      = buildEntities(normalized, intent);

  // If an ID was found but intent was tagged as unsupported — upgrade to lookup
  const finalIntent = (
    intent === INTENTS.UNSUPPORTED_QUERY &&
    applicationId !== null
  )
    ? INTENTS.APPLICANT_LOOKUP
    : intent;

  return {
    intent:          finalIntent,
    applicationId,
    entities,
    normalizedQuery: normalized,
    confidence,
  };
}
