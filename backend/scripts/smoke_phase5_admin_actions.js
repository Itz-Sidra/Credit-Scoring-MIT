/*
  Phase 5 smoke test: apply -> admin list filters -> approve/reject -> explainability

  Usage:
    npm run smoke:phase5

  Notes:
    - Backend server must already be running on API_BASE_URL.
    - Script creates/uses test users directly in DB and signs JWTs locally.
*/

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import User from "../src/models/User.js";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000/api";
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = "credit";
const JWT_SECRET = process.env.JWT_SECRET || "altcreditsecret";

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let body = null;
  try {
    body = await response.json();
  } catch (error) {
    body = null;
  }
  return { response, body };
}

async function ensureUsers() {
  let borrower = await User.findOne({ email: "phase5-borrower@example.com" });
  if (!borrower) {
    borrower = await User.create({
      fullName: "Phase5 Borrower",
      email: "phase5-borrower@example.com",
      phone: "9000000001",
      password: "test123",
      role: "user",
      isOnBoarded: true,
      phoneVerified: true,
      emailVerified: true,
      incomTotal: 320000,
      gender: "M",
      nameIncomeType: "Working",
      nameEducationType: "Higher education",
      nameContractType: "Cash loans",
      daysEmployed: -2000,
      daysBirth: -11800,
    });
  }

  let admin = await User.findOne({ email: "phase5-admin@example.com" });
  if (!admin) {
    admin = await User.create({
      fullName: "Phase5 Admin",
      email: "phase5-admin@example.com",
      phone: "9000000002",
      password: "test123",
      role: "admin",
      adminLoanType: "personal",
      isOnBoarded: true,
      phoneVerified: true,
      emailVerified: true,
    });
  }

  return { borrower, admin };
}

async function submitLoan(userToken, amount, tag) {
  const payload = {
    loanType: "personal",
    requestedAmount: amount,
    requestedTenure: 24,
    purpose: `phase5-${tag}`,
    age: 31,
    collateral: { type: "none" },
  };

  const result = await requestJson(`${API_BASE_URL}/loan/apply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  assertCondition(
    result.response.ok,
    `Loan apply failed (${result.response.status})`
  );
  const loanId = result.body?.data?.loanId;
  assertCondition(Boolean(loanId), "Missing loanId after apply");
  return { loanId, status: result.body?.data?.status };
}

async function main() {
  assertCondition(
    Boolean(MONGO_URI),
    "MONGO_URI missing. Run with --env-file=.env or export env vars."
  );

  console.log("\n[0/7] Connecting to MongoDB...");
  await mongoose.connect(`${MONGO_URI}/${DB_NAME}`, {
    serverSelectionTimeoutMS: 6000,
  });
  console.log("  OK connected");

  const { borrower, admin } = await ensureUsers();
  const userToken = jwt.sign(
    { userId: borrower._id, role: "user" },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
  const adminToken = jwt.sign(
    { userId: admin._id, role: "admin" },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  console.log("\n[1/7] Submitting two test loans...");
  const loanA = await submitLoan(userToken, 170000, "approve-candidate");
  const loanB = await submitLoan(userToken, 240000, "reject-candidate");
  console.log(`  OK loanA=${loanA.loanId} (${loanA.status})`);
  console.log(`  OK loanB=${loanB.loanId} (${loanB.status})`);

  console.log(
    "\n[2/7] Validating admin filter query (status + risk optional)..."
  );
  const listFiltered = await requestJson(
    `${API_BASE_URL}/admin/my-loans?status=under_review,auto_approved,auto_rejected&risk=low,medium,high&loanType=personal`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  assertCondition(
    listFiltered.response.ok,
    `Filtered list failed (${listFiltered.response.status})`
  );
  assertCondition(
    Array.isArray(listFiltered.body?.loans),
    "Filtered list missing loans array"
  );
  console.log(`  OK filtered loans count=${listFiltered.body.loans.length}`);

  console.log("\n[3/7] Approving loan A...");
  const approveRes = await requestJson(
    `${API_BASE_URL}/admin/loans/${loanA.loanId}/approve`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        approvedAmount: 120000,
        interestRate: 12.9,
        tenure: 24,
        notes: "phase5 smoke approve",
      }),
    }
  );
  assertCondition(
    approveRes.response.ok,
    `Approve failed (${approveRes.response.status})`
  );

  console.log("\n[4/7] Rejecting loan B...");
  const rejectRes = await requestJson(
    `${API_BASE_URL}/admin/loans/${loanB.loanId}/reject`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rejectionReason: "phase5 smoke reject" }),
    }
  );
  assertCondition(
    rejectRes.response.ok,
    `Reject failed (${rejectRes.response.status})`
  );

  console.log("\n[5/7] Fetching admin loan details and decision summary...");
  const detailA = await requestJson(
    `${API_BASE_URL}/admin/my-loans/${loanA.loanId}`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
  const detailB = await requestJson(
    `${API_BASE_URL}/admin/my-loans/${loanB.loanId}`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
  assertCondition(
    detailA.response.ok,
    `Detail A failed (${detailA.response.status})`
  );
  assertCondition(
    detailB.response.ok,
    `Detail B failed (${detailB.response.status})`
  );
  assertCondition(
    Boolean(detailA.body?.loan?.decisionSummary),
    "Detail A missing decisionSummary"
  );
  assertCondition(
    Boolean(detailB.body?.loan?.decisionSummary),
    "Detail B missing decisionSummary"
  );

  console.log("\n[6/7] Fetching explainability endpoint...");
  const explainA = await requestJson(
    `${API_BASE_URL}/admin/loans/${loanA.loanId}/explainability`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
  assertCondition(
    explainA.response.ok,
    `Explainability failed (${explainA.response.status})`
  );
  assertCondition(
    Boolean(explainA.body?.explainability),
    "Explainability payload missing"
  );

  console.log("\n[7/7] Contract checks for frontend compatibility keys...");
  const aiA = detailA.body?.loan?.aiAnalysis || {};
  assertCondition("creditScore" in aiA, "Missing aiAnalysis.creditScore");
  assertCondition("riskLevel" in aiA, "Missing aiAnalysis.riskLevel");
  assertCondition("eligibleAmount" in aiA, "Missing aiAnalysis.eligibleAmount");
  assertCondition(
    "suggestedInterestRate" in aiA,
    "Missing aiAnalysis.suggestedInterestRate"
  );

  console.log("\nPhase 5 smoke test passed end-to-end.\n");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("\nPhase 5 smoke test failed:");
  console.error(error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    // Ignore disconnect errors.
  }
  process.exit(1);
});
