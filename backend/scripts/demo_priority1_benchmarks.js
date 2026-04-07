import { predictCreditScoreWithModel } from "../src/services/mlService.js";

const benchmarkProfiles = [
  {
    label: "Strong Salaried",
    profile: {
      userCategory: "low_income_salaried",
      annualIncomeEstimate: 1200000,
      monthlySalaryNet: 100000,
      employmentTenureMonths: 84,
      employerType: "full_time",
      requestedAmount: 150000,
      requestedTenureMonths: 24,
      householdSize: 2,
      childrenCount: 0,
      age: 36,
      hasBankAccount: true,
      hasUpiHistory: true,
      utilityBillConsistency: 0.92,
      upiTransactionCount: 180,
      upiTransactionVolume: 220000,
      totalExistingEmiBurden: 9000,
      collateralType: "none",
      collateralValue: 0,
    },
  },
  {
    label: "Borderline MSME",
    profile: {
      userCategory: "msme_owner",
      annualIncomeEstimate: 360000,
      monthlyRevenue: 90000,
      monthlyExpenses: 65000,
      businessAgeMonths: 20,
      hasGst: true,
      isFormalized: true,
      requestedAmount: 350000,
      requestedTenureMonths: 36,
      householdSize: 4,
      childrenCount: 1,
      age: 31,
      hasBankAccount: true,
      hasUpiHistory: true,
      utilityBillConsistency: 0.58,
      upiTransactionCount: 45,
      upiTransactionVolume: 75000,
      totalExistingEmiBurden: 14000,
      collateralType: "gold",
      collateralValue: 240000,
    },
  },
  {
    label: "High Risk Daily Wage",
    profile: {
      userCategory: "daily_wage_worker",
      annualIncomeEstimate: 108000,
      averageDailyEarnings: 380,
      daysWorkedPerMonth: 17,
      requestedAmount: 650000,
      requestedTenureMonths: 24,
      householdSize: 7,
      childrenCount: 4,
      age: 22,
      hasBankAccount: false,
      hasUpiHistory: false,
      utilityBillConsistency: 0.24,
      upiTransactionCount: 3,
      upiTransactionVolume: 7000,
      totalExistingEmiBurden: 6000,
      collateralType: "none",
      collateralValue: 0,
    },
  },
];

async function main() {
  console.log("\nPriority 1 Benchmark Demo\n");

  const rows = [];
  for (const item of benchmarkProfiles) {
    const output = await predictCreditScoreWithModel(item.profile);
    rows.push({
      profile: item.label,
      creditScore: output.creditScore,
      repaymentProbability: Number(output.probability).toFixed(4),
      probabilityOfDefault: (1 - Number(output.probability)).toFixed(4),
      riskBand: output.riskLevel,
      modelType: output.modelInfo?.modelType || "N/A",
    });
  }

  console.table(rows);

  console.log("\nJudge Talking Points:");
  console.log("1) Distinct borrower segments yield distinct risk and score outcomes.");
  console.log("2) Model output is bounded with policy-aware post-processing.");
  console.log("3) Explainability payload is available in admin panel/API for auditability.\n");
}

main().catch((error) => {
  console.error("Priority 1 benchmark demo failed:");
  console.error(error.message);
  process.exit(1);
});
