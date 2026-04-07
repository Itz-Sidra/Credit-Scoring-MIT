/**
 * Phase 4 Test Script — Query Router
 *
 * Verifies intent detection + entity extraction for a wide range of queries.
 * No DB, no network — pure function tests.
 *
 * Usage:
 *   node backend/scripts/testQueryRouter.js
 */

import { routeQuery, INTENTS } from "../src/services/queryRouterService.js";

// ── Test cases ────────────────────────────────────────────────────────────────
const TESTS = [
  // Required from spec
  {
    query:    "Show application 69c7c8d1457f8adf69e556dd",
    expected: INTENTS.APPLICANT_LOOKUP,
    note:     "ID present → applicant_lookup",
  },
  {
    query:    "Why is this applicant on hold?",
    expected: INTENTS.RISK_EXPLANATION,
    note:     "hold + why → risk_explanation",
  },
  {
    query:    "What should this applicant improve?",
    expected: INTENTS.IMPROVEMENT_SUGGESTION,
    note:     "improve + applicant → improvement_suggestion",
  },
  {
    query:    "Find similar applicants to this one",
    expected: INTENTS.SIMILAR_APPLICANTS,
    note:     "similar applicants → similar_applicants",
  },
  {
    query:    "How many applicants are on hold due to identity issues?",
    expected: INTENTS.AGGREGATE_INSIGHT,
    note:     "how many → aggregate_insight + reason entity",
  },
  {
    query:    "Tell me about football",
    expected: INTENTS.UNSUPPORTED_QUERY,
    note:     "no credit domain words → unsupported",
  },
  // Extended coverage
  {
    query:    "Pull up applicant 507f1f77bcf86cd799439011",
    expected: INTENTS.APPLICANT_LOOKUP,
    note:     "pull up + ID",
  },
  {
    query:    "Why was this loan rejected?",
    expected: INTENTS.RISK_EXPLANATION,
    note:     "why + rejected → risk_explanation",
  },
  {
    query:    "Why was the eligible amount lower than requested?",
    expected: INTENTS.RISK_EXPLANATION,
    note:     "why + eligible amount lower → risk_explanation",
  },
  {
    query:    "How can this applicant qualify for the loan?",
    expected: INTENTS.IMPROVEMENT_SUGGESTION,
    note:     "how can + qualify → improvement_suggestion",
  },
  {
    query:    "What steps can they take to get approved?",
    expected: INTENTS.IMPROVEMENT_SUGGESTION,
    note:     "steps + get approved → improvement_suggestion",
  },
  {
    query:    "Compare application 69c7c8d1457f8adf69e556dd and 507f1f77bcf86cd799439011",
    expected: INTENTS.COMPARISON,
    note:     "compare + two IDs → comparison + entity extraction",
  },
  {
    query:    "Compare this applicant with another one",
    expected: INTENTS.COMPARISON,
    note:     "compare → comparison",
  },
  {
    query:    "Show similar high-risk salaried borrowers",
    expected: INTENTS.SIMILAR_APPLICANTS,
    note:     "similar + high-risk + salaried entity extraction",
  },
  {
    query:    "Average credit score by borrower type",
    expected: INTENTS.AGGREGATE_INSIGHT,
    note:     "average + credit → aggregate_insight",
  },
  {
    query:    "Top rejection reasons for salaried applicants",
    expected: INTENTS.AGGREGATE_INSIGHT,
    note:     "top + rejection reasons → aggregate_insight",
  },
  {
    query:    "Total number of high-risk loans this month",
    expected: INTENTS.AGGREGATE_INSIGHT,
    note:     "total + high-risk → aggregate_insight",
  },
  {
    query:    "What is the capital of France?",
    expected: INTENTS.UNSUPPORTED_QUERY,
    note:     "geography question → unsupported",
  },
  {
    query:    "Explain machine learning",
    expected: INTENTS.UNSUPPORTED_QUERY,
    note:     "generic ML question → unsupported",
  },
  {
    query:    "Why is the risk level high for this applicant?",
    expected: INTENTS.RISK_EXPLANATION,
    note:     "why + risk → risk_explanation",
  },
  {
    query:    "Fetch case 69c7c8d1457f8adf69e556dd",
    expected: INTENTS.APPLICANT_LOOKUP,
    note:     "fetch + case + ID",
  },
  {
    query:    "507f1f77bcf86cd799439011",
    expected: INTENTS.APPLICANT_LOOKUP,
    note:     "bare ID → upgraded to applicant_lookup",
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

console.log("Phase 4 — Query Router Test Suite\n");
console.log("=".repeat(70));

for (const tc of TESTS) {
  const result = routeQuery(tc.query);
  const ok     = result.intent === tc.expected;

  if (ok) {
    passed++;
    process.stdout.write(`  ✅ `);
  } else {
    failed++;
    process.stdout.write(`  ❌ `);
  }

  console.log(`[${tc.note}]`);
  console.log(`     Query    : "${tc.query}"`);
  if (!ok) {
    console.log(`     Expected : ${tc.expected}`);
    console.log(`     Got      : ${result.intent}`);
  } else {
    console.log(`     Intent   : ${result.intent} (${result.confidence})`);
  }

  if (result.applicationId) {
    console.log(`     App ID   : ${result.applicationId}`);
  }
  if (Object.keys(result.entities).length > 0) {
    console.log(`     Entities : ${JSON.stringify(result.entities)}`);
  }
  console.log();
}

console.log("=".repeat(70));
console.log(`Results: ${passed} passed, ${failed} failed (${TESTS.length} total)`);

if (failed > 0) {
  process.exit(1);
}
