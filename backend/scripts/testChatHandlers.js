/**
 * Phase 5 Test Script — Chat Handlers / Orchestration Layer
 *
 * Tests the full query-to-answer pipeline for each intent.
 * Requires a live MongoDB connection (backend/.env) and optionally Ollama.
 *
 * Usage (from workspace root):
 *   node backend/scripts/testChatHandlers.js
 *
 * With specific IDs:
 *   APP_ID=<id1> APP_ID_B=<id2> node backend/scripts/testChatHandlers.js
 *
 * Requires: backend/.env  (MONGO_URI, optionally OLLAMA_BASE_URL / OLLAMA_MODEL)
 */

import path      from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dotenv    = await import("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import mongoose from "mongoose";
import { processCopilotQuery } from "../src/services/chatHandlerService.js";
import { getAllApplicantCards }  from "../src/services/applicantFetchService.js";
import { checkOllamaHealth }    from "../src/services/ollamaService.js";

// ── Connect ───────────────────────────────────────────────────────────────────
async function connect() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set in backend/.env");
  await mongoose.connect(uri);
  console.log("✅ MongoDB connected\n");
}

// ── Print helper ──────────────────────────────────────────────────────────────
function printResult(label, result) {
  console.log("─".repeat(72));
  console.log(`🧪  ${label}`);
  console.log("─".repeat(72));
  console.log(`  Intent      : ${result.intent}`);
  console.log(`  ContextType : ${result.contextType}`);
  console.log(`  Sources     : ${result.sources?.join(", ") || "(none)"}`);
  console.log(`  Routed As   : ${result.routedQuery?.intent} [${result.routedQuery?.confidence}]`);
  if (Object.keys(result.routedQuery?.entities || {}).length) {
    console.log(`  Entities    : ${JSON.stringify(result.routedQuery.entities)}`);
  }
  console.log("");
  // Trim very long LLM answers in test output
  const answer = (result.answer || "").trim();
  const display = answer.length > 1200 ? answer.slice(0, 1200) + "\n  …[truncated]" : answer;
  console.log("  Answer:\n");
  display.split("\n").forEach((line) => console.log(`    ${line}`));
  console.log("");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function runTests(idA, idB) {
  let passed = 0;
  let failed = 0;
  const results = [];

  const run = async (label, query, overrideId = null, expectIntent) => {
    try {
      const result = await processCopilotQuery({ query, applicationId: overrideId });
      printResult(label, result);
      if (expectIntent && result.intent !== expectIntent) {
        console.warn(`  ⚠️  Intent mismatch — expected "${expectIntent}", got "${result.intent}"\n`);
        failed++;
      } else {
        passed++;
      }
      results.push({ label, intent: result.intent, ok: true });
    } catch (err) {
      console.error(`  ❌ CRASH in "${label}": ${err.message}\n`);
      failed++;
      results.push({ label, intent: "ERROR", ok: false });
    }
  };

  // ── Test 1: applicant_lookup with real ID ─────────────────────────────────
  if (idA) {
    await run(
      "applicant_lookup — real ID from DB",
      `Show application ${idA}`,
      null,
      "applicant_lookup"
    );
  } else {
    await run(
      "applicant_lookup — no ID provided",
      "Show me an application",
      null,
      "applicant_lookup"
    );
  }

  // ── Test 2: risk_explanation ──────────────────────────────────────────────
  if (idA) {
    await run(
      "risk_explanation — real ID",
      `Why is application ${idA} on hold?`,
      null,
      "risk_explanation"
    );
  } else {
    await run(
      "risk_explanation — no ID (expects guidance response)",
      "Why is this applicant on hold?",
      null,
      "risk_explanation"
    );
  }

  // ── Test 3: improvement_suggestion ───────────────────────────────────────
  if (idA) {
    await run(
      "improvement_suggestion — real ID",
      `What should applicant ${idA} improve to qualify?`,
      null,
      "improvement_suggestion"
    );
  } else {
    await run(
      "improvement_suggestion — no ID",
      "What should this applicant improve to qualify?",
      null,
      "improvement_suggestion"
    );
  }

  // ── Test 4: comparison — both IDs present ─────────────────────────────────
  if (idA && idB) {
    await run(
      "comparison — two real IDs",
      `Compare application ${idA} and ${idB}`,
      null,
      "comparison"
    );
  } else {
    await run(
      "comparison — missing IDs (expects guidance response)",
      "Compare this applicant with another one",
      null,
      "comparison"
    );
  }

  // ── Test 5: aggregate_insight — identity hold count ───────────────────────
  await run(
    "aggregate_insight — on hold due to identity issues",
    "How many applicants are on hold due to identity issues?",
    null,
    "aggregate_insight"
  );

  // ── Test 6: aggregate_insight — portfolio summary ─────────────────────────
  await run(
    "aggregate_insight — portfolio summary",
    "How many total applications are in the system?",
    null,
    "aggregate_insight"
  );

  // ── Test 7: aggregate_insight — rejection reasons ─────────────────────────
  await run(
    "aggregate_insight — top rejection reasons for salaried",
    "Top rejection reasons for salaried applicants",
    null,
    "aggregate_insight"
  );

  // ── Test 8: similar_applicants — real Chroma retrieval ───────────────────
  if (idA) {
    await run(
      "similar_applicants — real Chroma retrieval with base card",
      `Find similar applicants to ${idA}`,
      null,
      "similar_applicants"
    );
  } else {
    await run(
      "similar_applicants — freetext query (no base ID)",
      "Show similar high-risk salaried borrowers",
      null,
      "similar_applicants"
    );
  }

  // ── Test 9: unsupported_query ─────────────────────────────────────────────
  await run(
    "unsupported_query — football",
    "Tell me about football",
    null,
    "unsupported_query"
  );

  // ── Test 10: UI context override (applicationId passed externally) ─────────
  if (idA) {
    await run(
      "improvement_suggestion — ID passed as UI context override",
      "What should this person improve?",   // no ID in text
      idA,                                   // but passed as override
      "improvement_suggestion"
    );
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("═".repeat(72));
  console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log("═".repeat(72));

  return failed;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  await connect();

  // Check Ollama — we continue even if unavailable (handlers degrade gracefully)
  const ollamaUp = await checkOllamaHealth();
  if (!ollamaUp) {
    console.warn(
      "⚠️  Ollama is not reachable — LLM-powered tests will use structural fallbacks.\n" +
      "   Start Ollama with:  ollama serve\n"
    );
  } else {
    console.log("✅ Ollama is reachable\n");
  }

  // Try to get real application IDs from the DB for richer tests
  let idA = process.env.APP_ID  || null;
  let idB = process.env.APP_ID_B || null;

  if (!idA) {
    console.log("ℹ️  No APP_ID set — fetching first two applications from DB for tests…");
    const cards = await getAllApplicantCards({ limit: 2, skip: 0 });
    if (cards.length >= 1) {
      idA = cards[0].applicationId;
      console.log(`   Using APP_ID  = ${idA}`);
    }
    if (cards.length >= 2) {
      idB = cards[1].applicationId;
      console.log(`   Using APP_ID_B = ${idB}`);
    }
    if (!idA) {
      console.warn("   ⚠️  No applications found in DB. ID-based tests will use guidance responses.\n");
    } else {
      console.log("");
    }
  }

  const failures = await runTests(idA, idB);

  await mongoose.disconnect();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
