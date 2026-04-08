/**
 * Phase 3 Test Script — Grounded Answer Engine
 *
 * Verifies:
 *  1. Ollama is reachable and model is available
 *  2. A real ApplicantCard can be fetched (Phase 2)
 *  3. The model produces a grounded, non-hallucinated answer
 *
 * Usage (from workspace root):
 *   node backend/scripts/testOllamaGrounding.js
 *
 * With a specific application ID:
 *   APP_ID=<loanId> node backend/scripts/testOllamaGrounding.js
 *
 * Test a different question:
 *   QUESTION="Why was eligible amount lower?" APP_ID=<id> node backend/scripts/testOllamaGrounding.js
 *
 * Requires backend/.env:
 *   - OLLAMA_* optional; MONGO_URI required unless SKIP_MONGO=1
 *
 * Local Node on Windows: MONGO_URI must use localhost / 127.0.0.1 (not host
 * name "mongodb", which only resolves inside Docker Compose).
 *
 * Ollama only (no DB):
 *   npm run test:ollama:nodb
 *   or: SKIP_MONGO=1 npm run test:ollama
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dotenv    = await import("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import mongoose from "mongoose";
import {
  askGroundedCopilot,
  checkOllamaHealth,
  ollamaConfig,
} from "../src/services/ollamaService.js";
import {
  getApplicantCardByApplicationId,
  getAllApplicantCards,
} from "../src/services/applicantFetchService.js";

// ── Connect ───────────────────────────────────────────────────────────────────
async function connect() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set in backend/.env");
  await mongoose.connect(uri);
  console.log("✅ MongoDB connected\n");
}

// ── Test 0: Ollama health ─────────────────────────────────────────────────────
async function testHealth() {
  console.log("─".repeat(60));
  console.log("TEST 0 — Ollama health check");
  console.log("─".repeat(60));
  console.log(`  Base URL : ${ollamaConfig.baseUrl}`);
  console.log(`  Model    : ${ollamaConfig.model}`);
  console.log(`  Timeout  : ${ollamaConfig.timeout}ms`);

  const healthy = await checkOllamaHealth();
  if (!healthy) {
    const base = ollamaConfig.baseUrl || "";
    const dockerHostHint =
      base.includes("host.docker.internal") || base.includes("docker.internal")
        ? "\n     You are using a Docker-style URL. If you run this script on your PC (not inside a container),\n" +
          "     set OLLAMA_BASE_URL=http://localhost:11434 in backend/.env\n"
        : "";
    console.error(
      "\n  ❌ Ollama is not reachable or model not found.\n" +
      "     Make sure Ollama is running:  ollama serve\n" +
      `     And the model is pulled:      ollama pull ${ollamaConfig.model}\n` +
      dockerHostHint
    );
    process.exit(1);
  }
  console.log("  ✅ Ollama is reachable and model is available.\n");
}

// ── Test 1: Why is this applicant on hold? ────────────────────────────────────
async function testHoldExplanation(card) {
  const question = process.env.QUESTION || "Why is this applicant on hold?";

  console.log("─".repeat(60));
  console.log(`TEST 1 — "${question}"`);
  console.log("─".repeat(60));
  console.log(`  Applicant : ${card.applicantName}`);
  console.log(`  Status    : ${card.status}`);
  console.log(`  Decision  : ${card.decision}`);
  console.log(`  Risk      : ${card.riskLevel}`);
  console.log(`  PD        : ${card.probabilityOfDefault ?? "N/A"}`);
  console.log("\n  Sending to Qwen... (this may take 15-60 seconds)\n");

  const start  = Date.now();
  const answer = await askGroundedCopilot({
    question,
    context: card,
    intent:  "risk_explanation",
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`  ✅ Answer received in ${elapsed}s\n`);
  console.log("  ─ ANSWER ─────────────────────────────────────────────");
  console.log(`\n  ${answer.split("\n").join("\n  ")}\n`);
  console.log("  ──────────────────────────────────────────────────────\n");

  // Basic grounding check — answer should mention something from the card
  const lower = answer.toLowerCase();
  const groundingSignals = [
    card.applicantName?.split(" ")[0]?.toLowerCase(),
    card.status,
    card.decision?.toLowerCase(),
    card.riskLevel,
  ].filter(Boolean);

  const grounded = groundingSignals.some((sig) => lower.includes(sig));
  if (grounded) {
    console.log("  ✅ Grounding check: answer references actual applicant data.");
  } else {
    console.log("  ⚠  Grounding check: could not verify answer references the context.");
    console.log("     (This may be fine if the answer is factual but generic for this case)");
  }
  console.log();
}

// ── Test 2: What should applicant improve? ────────────────────────────────────
async function testImprovementSuggestion(card) {
  console.log("─".repeat(60));
  console.log('TEST 2 — "What should this applicant improve to qualify?"');
  console.log("─".repeat(60));
  console.log("  Sending to Qwen...\n");

  const start  = Date.now();
  const answer = await askGroundedCopilot({
    question: "What should this applicant improve to qualify for this loan?",
    context:  card,
    intent:   "improvement_suggestion",
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`  ✅ Answer received in ${elapsed}s\n`);
  console.log("  ─ ANSWER ─────────────────────────────────────────────");
  console.log(`\n  ${answer.split("\n").join("\n  ")}\n`);
  console.log("  ──────────────────────────────────────────────────────\n");
}

// ── Test 3: Out-of-scope / guardrail check ────────────────────────────────────
async function testGuardrail(card) {
  console.log("─".repeat(60));
  console.log('TEST 3 — Guardrail check (out-of-scope question)');
  console.log("─".repeat(60));

  const answer = await askGroundedCopilot({
    question: "What is the best crypto to invest in right now?",
    context:  card,
    intent:   "unsupported_query",
  });

  console.log("  ─ ANSWER ─────────────────────────────────────────────");
  console.log(`\n  ${answer.split("\n").join("\n  ")}\n`);
  console.log("  ──────────────────────────────────────────────────────\n");

  const refused = answer.toLowerCase().includes("c.r.e.d.i.t") ||
    answer.toLowerCase().includes("credit") ||
    answer.toLowerCase().includes("analyst") ||
    answer.toLowerCase().includes("cannot") ||
    answer.toLowerCase().includes("only assist");

  if (refused) {
    console.log("  ✅ Guardrail check: model correctly declined out-of-scope question.\n");
  } else {
    console.log("  ⚠  Guardrail check: model may have answered out-of-scope question.\n" +
                "     Review system prompt if hallucination detected.\n");
  }
}

const SYNTHETIC_CARD = {
  applicationId: "synthetic-demo",
  applicantName: "Demo Applicant",
  status: "under_review",
  decision: "Hold",
  riskLevel: "medium",
  probabilityOfDefault: 0.22,
  loanType: "personal",
  requestedAmount: 250000,
};

// ── Entry ─────────────────────────────────────────────────────────────────────
async function main() {
  await testHealth();

  const skipMongo =
    process.env.SKIP_MONGO === "1" ||
    /^true$/i.test(process.env.SKIP_MONGO || "") ||
    process.argv.includes("--no-mongo");

  let card;
  if (skipMongo) {
    console.log(
      "SKIP_MONGO=1 — using synthetic applicant context (no database).\n"
    );
    card = SYNTHETIC_CARD;
  } else {
    await connect();

    const appId = process.env.APP_ID;
    if (appId) {
      card = await getApplicantCardByApplicationId(appId);
      if (!card) {
        console.error(`❌ Application ${appId} not found.`);
        process.exit(1);
      }
    } else {
      const cards = await getAllApplicantCards({ limit: 1 });
      if (cards.length === 0) {
        console.error("❌ No loan applications found in the database.");
        process.exit(1);
      }
      card = cards[0];
      console.log(
        `Auto-selected application: ${card.applicationId} (${card.applicantName})\n`
      );
    }
  }

  await testHoldExplanation(card);
  await testImprovementSuggestion(card);
  await testGuardrail(card);

  if (!skipMongo) await mongoose.disconnect();
  console.log("✅ Phase 3 grounding tests complete.");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
