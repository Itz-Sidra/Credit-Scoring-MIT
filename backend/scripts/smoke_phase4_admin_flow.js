/*
  Phase 4 smoke test: apply -> admin list -> admin detail

  Usage:
    npm run smoke:phase4

  Optional:
    API_BASE_URL=http://localhost:8000/api
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
  let borrower = await User.findOne({ email: "phase4-borrower@example.com" });
  if (!borrower) {
    borrower = await User.create({
      fullName: "Phase4 Borrower",
      email: "phase4-borrower@example.com",
      phone: "9000000011",
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

  let admin = await User.findOne({ email: "phase4-admin@example.com" });
  if (!admin) {
    admin = await User.create({
      fullName: "Phase4 Admin",
      email: "phase4-admin@example.com",
      phone: "9000000012",
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

async function resolveTokens() {
  if (process.env.USER_TOKEN && process.env.ADMIN_TOKEN) {
    return {
      userToken: process.env.USER_TOKEN,
      adminToken: process.env.ADMIN_TOKEN,
      openedDb: false,
    };
  }

  assertCondition(
    Boolean(MONGO_URI),
    "Missing USER_TOKEN/ADMIN_TOKEN and MONGO_URI is not set"
  );
  await mongoose.connect(`${MONGO_URI}/${DB_NAME}`, {
    serverSelectionTimeoutMS: 6000,
  });
  const { borrower, admin } = await ensureUsers();

  return {
    userToken: jwt.sign({ userId: borrower._id, role: "user" }, JWT_SECRET, {
      expiresIn: "24h",
    }),
    adminToken: jwt.sign({ userId: admin._id, role: "admin" }, JWT_SECRET, {
      expiresIn: "24h",
    }),
    openedDb: true,
  };
}

async function main() {
  const { userToken, adminToken, openedDb } = await resolveTokens();

  console.log("\n[1/4] Submitting loan application as user...");
  const loanPayload = {
    loanType: "personal",
    requestedAmount: 125000,
    requestedTenure: 24,
    purpose: "Phase 4 smoke test",
    age: 29,
  };

  const applyResult = await requestJson(`${API_BASE_URL}/loan/apply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(loanPayload),
  });

  assertCondition(
    applyResult.response.ok,
    `Apply failed (${applyResult.response.status}): ${JSON.stringify(applyResult.body)}`
  );

  const loanId = applyResult.body?.data?.loanId;
  assertCondition(Boolean(loanId), "No loanId in apply response");
  console.log(`  OK: loan created ${loanId}`);

  console.log("\n[2/4] Fetching admin loan list...");
  const adminListResult = await requestJson(`${API_BASE_URL}/admin/my-loans`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  assertCondition(
    adminListResult.response.ok,
    `Admin list failed (${adminListResult.response.status}): ${JSON.stringify(adminListResult.body)}`
  );

  const loans = adminListResult.body?.loans || [];
  const targetFromList = loans.find((loan) => loan?._id === loanId);
  assertCondition(
    Boolean(targetFromList),
    `Loan ${loanId} not present in admin list`
  );
  console.log(`  OK: loan appears in admin list (${loans.length} total)`);

  console.log("\n[3/4] Fetching admin loan detail by id...");
  const adminDetailResult = await requestJson(
    `${API_BASE_URL}/admin/my-loans/${loanId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    }
  );

  assertCondition(
    adminDetailResult.response.ok,
    `Admin detail failed (${adminDetailResult.response.status}): ${JSON.stringify(adminDetailResult.body)}`
  );

  const detailedLoan = adminDetailResult.body?.loan;
  assertCondition(
    Boolean(detailedLoan),
    "No loan object in admin detail response"
  );
  assertCondition(
    Boolean(detailedLoan.decisionSummary),
    "No decisionSummary in admin detail response"
  );

  console.log("  OK: admin detail includes decisionSummary");
  console.log(`  decision=${detailedLoan.decisionSummary?.decision}`);
  console.log(
    `  preScreenStatus=${detailedLoan.decisionSummary?.preScreenStatus}`
  );

  console.log("\n[4/4] Verifying compatibility keys...");
  const ai = detailedLoan.aiAnalysis || {};
  assertCondition("creditScore" in ai, "Missing aiAnalysis.creditScore");
  assertCondition("riskLevel" in ai, "Missing aiAnalysis.riskLevel");
  assertCondition("eligibleAmount" in ai, "Missing aiAnalysis.eligibleAmount");
  assertCondition(
    "suggestedInterestRate" in ai,
    "Missing aiAnalysis.suggestedInterestRate"
  );
  console.log("  OK: compatibility keys intact");

  if (openedDb) {
    await mongoose.disconnect();
  }

  console.log("\nPhase 4 smoke test passed.\n");
}

main().catch(async (error) => {
  console.error("\nPhase 4 smoke test failed:");
  console.error(error.message);
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  } catch {
    // Ignore disconnect errors.
  }
  process.exit(1);
});
