/**
 * Phase 1 Debug Script — Applicant Intelligence Layer
 *
 * Verifies the full card-building pipeline against real MongoDB data.
 *
 * Usage (from workspace root):
 *   node backend/scripts/debug_applicant_card.js
 *
 * Or by application ID:
 *   APP_ID=<mongoId> node backend/scripts/debug_applicant_card.js
 *
 * Requires backend/.env to be present (for MONGO_URI).
 */

import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

// ── Resolve .env from backend directory ──────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dotenv    = await import("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import mongoose from "mongoose";
import {
  getApplicantCardByApplicationId,
  getApplicantCardByUserId,
  getAllApplicantCards,
} from "../src/services/applicantFetchService.js";

// ── Connect ───────────────────────────────────────────────────────────────────
async function connect() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set — check backend/.env");
  await mongoose.connect(uri);
  console.log("✅ MongoDB connected\n");
}

// ── Test 1: Fetch a single card by application ID ────────────────────────────
async function testLookupById(appId) {
  console.log("─".repeat(60));
  console.log(`TEST 1 — Lookup by application ID: ${appId}`);
  console.log("─".repeat(60));

  const card = await getApplicantCardByApplicationId(appId);
  if (!card) {
    console.log("⚠  Not found.");
    return;
  }

  printCard(card);
}

// ── Test 2: Bulk fetch (first 3 cards) ───────────────────────────────────────
async function testBulkFetch() {
  console.log("─".repeat(60));
  console.log("TEST 2 — Bulk fetch (first 3 cards)");
  console.log("─".repeat(60));

  const cards = await getAllApplicantCards({ limit: 3 });
  console.log(`✅ Returned ${cards.length} card(s)\n`);

  cards.forEach((card, i) => {
    console.log(`\n── Card ${i + 1}: ${card.applicantName} (${card.applicationId})`);
    console.log(`   Status: ${card.status} | Decision: ${card.decision} | Risk: ${card.riskLevel}`);
    console.log(`   PD: ${card.probabilityOfDefault ?? "N/A"} | Score: ${card.creditScore ?? "N/A"}`);
    console.log(`   + Positive factors (${card.topPositiveFactors.length}): ${card.topPositiveFactors.slice(0,2).join(" | ")}`);
    console.log(`   - Negative factors (${card.topNegativeFactors.length}): ${card.topNegativeFactors.slice(0,2).join(" | ")}`);
    console.log(`\n   Summary preview:\n   ${card.summary.slice(0, 250)}...`);
  });
}

// ── Printer ───────────────────────────────────────────────────────────────────
function printCard(card) {
  console.log(`\nApplicant Card — ${card.applicantName}`);
  console.log(`  Application ID : ${card.applicationId}`);
  console.log(`  User ID        : ${card.userId}`);
  console.log(`  Loan Type      : ${card.loanType}`);
  console.log(`  Status         : ${card.status}`);
  console.log(`  Decision       : ${card.decision}`);
  console.log(`  Risk Level     : ${card.riskLevel}`);
  console.log(`  Credit Score   : ${card.creditScore ?? "N/A"}`);
  console.log(`  PD             : ${card.probabilityOfDefault ?? "N/A"}`);
  console.log(`  Eligible Amt   : ${card.eligibleAmount ?? "N/A"}`);
  console.log(`  Requested Amt  : ${card.requestedAmount ?? "N/A"}`);
  console.log(`  Pre-screen     : ${card.preScreenStatus ?? "N/A"}`);
  console.log(`  Decision Reason: ${card.decisionReason ?? "N/A"}`);
  console.log(`  AML Flags      : ${card.amlFlags.join(", ") || "none"}`);
  console.log(`\n  ✅ Positive Factors (${card.topPositiveFactors.length}):`);
  card.topPositiveFactors.forEach((f) => console.log(`     + ${f}`));
  console.log(`\n  ⚠  Negative Factors (${card.topNegativeFactors.length}):`);
  card.topNegativeFactors.forEach((f) => console.log(`     - ${f}`));
  console.log(`\n  Summary:\n  ${card.summary}\n`);
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  await connect();

  const appId = process.env.APP_ID;

  if (appId) {
    await testLookupById(appId);
  } else {
    // No ID passed — run bulk test to show a sample
    await testBulkFetch();
  }

  await mongoose.disconnect();
  console.log("\n✅ Done.");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
