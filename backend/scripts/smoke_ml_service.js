import {
  getModelReadiness,
  predictCreditScoreWithModel,
} from "../src/services/mlService.js";

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isFiniteProbability(value) {
  return Number.isFinite(value) && value >= 0.05 && value <= 0.95;
}

async function main() {
  console.log("\n[1/3] Checking model readiness...");
  const readiness = await getModelReadiness();
  assertCondition(
    readiness.ready,
    `Model not ready: ${readiness.reason || "unknown"}`
  );
  console.log(`  OK artifact: ${readiness.artifactPath}`);

  console.log("\n[2/3] Running prediction sanity checks...");
  const strongProfile = {
    userCategory: "low_income_salaried",
    annualIncomeEstimate: 1200000,
    monthlySalaryNet: 100000,
    employmentTenureMonths: 72,
    employerType: "full_time",
    requestedAmount: 120000,
    requestedTenureMonths: 24,
    householdSize: 2,
    childrenCount: 0,
    age: 37,
    hasBankAccount: true,
    hasUpiHistory: true,
    utilityBillConsistency: 0.9,
    upiTransactionCount: 160,
    upiTransactionVolume: 180000,
    totalExistingEmiBurden: 8000,
    collateralType: "none",
    collateralValue: 0,
  };

  const weakProfile = {
    userCategory: "daily_wage_worker",
    annualIncomeEstimate: 90000,
    averageDailyEarnings: 350,
    daysWorkedPerMonth: 16,
    requestedAmount: 700000,
    requestedTenureMonths: 24,
    householdSize: 7,
    childrenCount: 4,
    age: 21,
    hasBankAccount: false,
    hasUpiHistory: false,
    utilityBillConsistency: 0.2,
    upiTransactionCount: 2,
    upiTransactionVolume: 5000,
    totalExistingEmiBurden: 6000,
    collateralType: "none",
    collateralValue: 0,
  };

  const strong = await predictCreditScoreWithModel(strongProfile);
  const weak = await predictCreditScoreWithModel(weakProfile);

  assertCondition(
    isFiniteProbability(Number(strong.probability)),
    "Strong profile probability out of bounds"
  );
  assertCondition(
    isFiniteProbability(Number(weak.probability)),
    "Weak profile probability out of bounds"
  );
  assertCondition(
    Number.isFinite(strong.creditScore),
    "Strong profile credit score is not finite"
  );
  assertCondition(
    Number.isFinite(weak.creditScore),
    "Weak profile credit score is not finite"
  );

  console.log(
    `  strong score=${strong.creditScore}, prob=${Number(strong.probability).toFixed(4)}, risk=${strong.riskLevel}`
  );
  console.log(
    `  weak   score=${weak.creditScore}, prob=${Number(weak.probability).toFixed(4)}, risk=${weak.riskLevel}`
  );

  console.log("\n[3/3] Checking profile variance...");
  const sameScore = Number(strong.creditScore) === Number(weak.creditScore);
  const sameProb =
    Math.abs(Number(strong.probability) - Number(weak.probability)) < 1e-6;
  assertCondition(
    !(sameScore && sameProb),
    "Different profiles produced identical score and probability"
  );
  console.log("  OK predictions vary across distinct profiles");

  console.log("\nML smoke test passed.\n");
}

main().catch((error) => {
  console.error("\nML smoke test failed:");
  console.error(error.message);
  process.exit(1);
});
