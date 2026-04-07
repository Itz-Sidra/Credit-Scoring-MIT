/**
 * Phase 2 Test Script — Exact Retrieval Layer
 *
 * Verifies all Phase 2 retrieval functions against real MongoDB data.
 *
 * Usage (from workspace root):
 *   node backend/scripts/testApplicantFetch.js
 *
 * With specific IDs:
 *   APP_ID=<loanId> USER_ID=<userId> node backend/scripts/testApplicantFetch.js
 *
 * Requires backend/.env to be present (MONGO_URI).
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dotenv    = await import("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import mongoose from "mongoose";
import {
  validateObjectId,
  getApplicantCardByApplicationId,
  getLatestApplicantCardByUserId,
  getAllApplicantCardsByUserId,
  getApplicantRawContextByApplicationId,
  getAllApplicantCards,
} from "../src/services/applicantFetchService.js";

// ── DB connect ────────────────────────────────────────────────────────────────
async function connect() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set in backend/.env");
  await mongoose.connect(uri);
  console.log("✅ MongoDB connected\n");
}

// ── Seed IDs from env or auto-discover ───────────────────────────────────────
async function resolveTestIds() {
  let appId  = process.env.APP_ID  || null;
  let userId = process.env.USER_ID || null;

  if (!appId || !userId) {
    // Auto-discover: grab first available loan application
    const LoanApplication = (await import("../src/models/LoanApplication.js")).default;
    const first = await LoanApplication.findOne().sort({ submittedAt: -1 }).lean();
    if (first) {
      appId  = appId  || String(first._id);
      userId = userId || String(first.userId);
    }
  }

  return { appId, userId };
}

// ─────────────────────────────────────────────────────────────────────────────

async function testValidateObjectId() {
  console.log("─".repeat(60));
  console.log("TEST 0 — validateObjectId()");
  console.log("─".repeat(60));

  const valid   = "507f1f77bcf86cd799439011";
  const invalid = "not-an-id";

  console.log(`  validateObjectId("${valid}")   → ${validateObjectId(valid)}`);
  console.log(`  validateObjectId("${invalid}") → ${validateObjectId(invalid)}`);
  console.log(`  validateObjectId(null)          → ${validateObjectId(null)}`);
  console.log();
}

async function testGetCardByApplicationId(appId) {
  console.log("─".repeat(60));
  console.log(`TEST 1 — getApplicantCardByApplicationId("${appId}")`);
  console.log("─".repeat(60));

  const card = await getApplicantCardByApplicationId(appId);
  if (!card) {
    console.log("  ⚠  Not found.\n");
    return;
  }
  printCardSummary(card, "Card");
}

async function testGetLatestByUserId(userId) {
  console.log("─".repeat(60));
  console.log(`TEST 2 — getLatestApplicantCardByUserId("${userId}")`);
  console.log("─".repeat(60));

  const card = await getLatestApplicantCardByUserId(userId);
  if (!card) {
    console.log("  ⚠  No applications found for this user.\n");
    return;
  }
  printCardSummary(card, "Latest Card");
}

async function testGetAllByUserId(userId) {
  console.log("─".repeat(60));
  console.log(`TEST 3 — getAllApplicantCardsByUserId("${userId}")`);
  console.log("─".repeat(60));

  const cards = await getAllApplicantCardsByUserId(userId);
  console.log(`  ✅ Found ${cards.length} application(s) for this user.`);
  cards.forEach((c, i) => {
    console.log(`  [${i + 1}] ${c.applicationId} — ${c.loanType} — ${c.status} — ${c.decision}`);
  });
  console.log();
}

async function testGetRawContext(appId) {
  console.log("─".repeat(60));
  console.log(`TEST 4 — getApplicantRawContextByApplicationId("${appId}")`);
  console.log("─".repeat(60));

  const ctx = await getApplicantRawContextByApplicationId(appId);
  if (!ctx) {
    console.log("  ⚠  Not found.\n");
    return;
  }

  console.log("  ✅ Raw loan keys :", Object.keys(ctx.loan).join(", "));
  if (ctx.user) {
    console.log("  ✅ Raw user keys :", Object.keys(ctx.user).join(", "));
    // SECURITY check — must never contain password/auth fields
    const forbidden = ["password", "loginAttempts", "lockedUntil", "__v"];
    const leaked    = forbidden.filter((f) => f in ctx.user);
    if (leaked.length > 0) {
      console.error(`  ❌ SECURITY: Sensitive fields leaked! → ${leaked.join(", ")}`);
    } else {
      console.log("  ✅ Security check passed — no sensitive fields exposed.");
    }
  } else {
    console.log("  User: null (not linked or not found)");
  }
  console.log();
}

async function testInvalidId() {
  console.log("─".repeat(60));
  console.log("TEST 5 — Invalid ObjectId handling");
  console.log("─".repeat(60));

  try {
    await getApplicantCardByApplicationId("not-a-real-id");
    console.log("  ❌ Should have thrown — did not.");
  } catch (err) {
    console.log(`  ✅ Correctly threw: ${err.message}`);
  }

  try {
    await getLatestApplicantCardByUserId("bad");
    console.log("  ❌ Should have thrown — did not.");
  } catch (err) {
    console.log(`  ✅ Correctly threw: ${err.message}`);
  }
  console.log();
}

async function testMissingId() {
  console.log("─".repeat(60));
  console.log("TEST 6 — Valid-format but non-existent ObjectId");
  console.log("─".repeat(60));

  const ghost = "000000000000000000000001";
  const result = await getApplicantCardByApplicationId(ghost);
  if (result === null) {
    console.log("  ✅ Correctly returned null for non-existent ID.");
  } else {
    console.log("  ❌ Expected null, got:", result);
  }
  console.log();
}

// ── Printer ───────────────────────────────────────────────────────────────────
function printCardSummary(card, label) {
  console.log(`\n  ✅ ${label} built successfully.`);
  console.log(`  Application ID   : ${card.applicationId}`);
  console.log(`  Applicant        : ${card.applicantName}`);
  console.log(`  Loan Type        : ${card.loanType}`);
  console.log(`  Status           : ${card.status}`);
  console.log(`  Decision         : ${card.decision}`);
  console.log(`  Risk Level       : ${card.riskLevel}`);
  console.log(`  Credit Score     : ${card.creditScore ?? "N/A"}`);
  console.log(`  PD               : ${card.probabilityOfDefault ?? "N/A"}`);
  console.log(`  Eligible Amount  : ${card.eligibleAmount ?? "N/A"}`);
  console.log(`  Pre-screen       : ${card.preScreenStatus ?? "N/A"}`);
  console.log(`  AML Flags        : ${card.amlFlags.join(", ") || "none"}`);
  console.log(`  Positive (+${card.topPositiveFactors.length})     : ${card.topPositiveFactors[0] || "none"}`);
  console.log(`  Negative (-${card.topNegativeFactors.length})     : ${card.topNegativeFactors[0] || "none"}`);
  console.log(`\n  Summary:\n  ${card.summary.slice(0, 300)}...`);
  console.log();
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  await connect();

  const { appId, userId } = await resolveTestIds();

  if (!appId || !userId) {
    console.log("⚠  No loan applications found in the database. Skipping live tests.");
    await testValidateObjectId();
    await testInvalidId();
    await testMissingId();
  } else {
    console.log(`Using appId=${appId}  userId=${userId}\n`);
    await testValidateObjectId();
    await testGetCardByApplicationId(appId);
    await testGetLatestByUserId(userId);
    await testGetAllByUserId(userId);
    await testGetRawContext(appId);
    await testInvalidId();
    await testMissingId();
  }

  await mongoose.disconnect();
  console.log("✅ Phase 2 retrieval tests complete.");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
