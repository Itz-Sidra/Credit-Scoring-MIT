import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");

const DEFAULT_MANIFEST_PATH = path.resolve(
  backendRoot,
  "models/integration_contracts/winner_upgrade_v5/winner_v5_serving_manifest.json"
);

const DEFAULT_ARTIFACT_PATH = path.resolve(
  backendRoot,
  "models/integration_contracts/winner_upgrade_v5/winner_v5_serving_artifact.pkl"
);

const WINNER_V5_FEATURE_DEFAULTS = {
  monthly_income: 33222.0,
  income_stability: 0.625,
  loan_to_income_ratio: 0.5313786008230452,
  emi_to_income_ratio: 0.28,
  age_at_application: 43.83287671232877,
  has_bank_account: 1.0,
  has_upi_history: 0.75,
  transaction_consistency: 0.6394718696837632,
  utility_payment_score: 0.5973875136755935,
  savings_buffer_ratio: 0.10428571428571429,
  spending_pattern_ratio: 0.709,
  cash_flow_volatility: 0.3931428571428571,
  estimated_monthly_income: 0.0,
  income_stability_score: 0.0,
  work_consistency_score: 0.0,
  platform_trust_score: 0.0,
  num_platforms: 0.0,
  weekly_income_cv: 0.0,
  platform_tenure_score: 0.0,
  active_day_ratio: 0.0,
  monthly_revenue: 0.0,
  monthly_expenses: 0.0,
  profit_margin: 0.0,
  expense_to_revenue_ratio: 0.0,
  revenue_growth_trend: 0.0,
  has_gst: 0.0,
  has_udyam: 0.0,
  is_formalized: 0.0,
  business_age_score: 0.0,
  land_size: 0.0,
  land_value_proxy: 0.0,
  seasonal_income_flag: 0.0,
  harvest_income_multiplier: 0.0,
  irrigation_quality_score: 0.0,
  has_kcc: 0.0,
  monthly_salary: 22500.0,
  employment_tenure_score: 0.2857142857142857,
  employment_formalization_score: 0.7,
  salary_to_account: 1.0,
  has_nominee: 0.0,
  nominee_income_ratio: 0.0,
  has_verified_collateral: 0.0,
  collateral_value: 0.0,
  nominee_relationship_score: 0.1,
};

const WINNER_V5_FEATURE_NAMES = Object.keys(WINNER_V5_FEATURE_DEFAULTS);

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function estimateMonthlyEmi(principal, tenureMonths, annualRate = 18) {
  const safePrincipal = toFiniteNumber(principal, 0);
  const safeTenure = Math.max(0, Math.round(toFiniteNumber(tenureMonths, 0)));
  if (safePrincipal <= 0 || safeTenure <= 0) {
    return 0;
  }

  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) {
    return safePrincipal / safeTenure;
  }

  const numerator =
    safePrincipal * monthlyRate * (1 + monthlyRate) ** safeTenure;
  const denominator = (1 + monthlyRate) ** safeTenure - 1;
  return denominator === 0 ? 0 : numerator / denominator;
}

function inferUserCategory(payload) {
  const raw = String(
    payload?.userCategory || payload?.borrowerType || payload?.occupation || ""
  ).toLowerCase();
  if (raw.includes("farmer")) return "farmer";
  if (raw.includes("gig") || raw.includes("delivery") || raw.includes("driver"))
    return "gig_worker";
  if (raw.includes("daily") || raw.includes("wage") || raw.includes("labour"))
    return "daily_wage_worker";
  if (raw.includes("msme") || raw.includes("business")) return "msme_owner";
  if (
    raw.includes("homemaker") ||
    raw.includes("no_income") ||
    raw.includes("housewife")
  )
    return "homemaker";
  return "low_income_salaried";
}

function deriveMonthlyIncome(payload) {
  const monthlyIncome = toFiniteNumber(payload?.monthlyIncome, 0);
  if (monthlyIncome > 0) return monthlyIncome;

  const annualIncome = toFiniteNumber(payload?.annualIncomeEstimate, 0);
  if (annualIncome > 0) return annualIncome / 12;

  const monthlySalary = toFiniteNumber(payload?.monthlySalaryNet, 0);
  if (monthlySalary > 0) return monthlySalary;

  const householdMonthlyIncome = toFiniteNumber(
    payload?.householdMonthlyIncome,
    0
  );
  if (householdMonthlyIncome > 0) return householdMonthlyIncome;

  const dailyIncome = toFiniteNumber(payload?.averageDailyEarnings, 0);
  const daysWorked = toFiniteNumber(payload?.daysWorkedPerMonth, 0);
  if (dailyIncome > 0 && daysWorked > 0) return dailyIncome * daysWorked;

  const weeklyIncome = toFiniteNumber(payload?.averageWeeklyEarnings, 0);
  if (weeklyIncome > 0) return weeklyIncome * 4.33;

  const monthlyRevenue = toFiniteNumber(payload?.monthlyRevenue, 0);
  const monthlyExpenses = toFiniteNumber(payload?.monthlyExpenses, 0);
  if (monthlyRevenue > 0) return Math.max(0, monthlyRevenue - monthlyExpenses);

  const allowance = toFiniteNumber(payload?.monthlyAllowance, 0);
  if (allowance > 0) return allowance;

  const landSize = toFiniteNumber(payload?.landSize, 0);
  if (landSize > 0) return landSize * 5000;

  return WINNER_V5_FEATURE_DEFAULTS.monthly_income;
}

function directFeatureOverlap(payload) {
  return WINNER_V5_FEATURE_NAMES.filter((name) =>
    Object.hasOwn(payload || {}, name)
  ).length;
}

function buildFeaturesFromPayload(payload) {
  if (directFeatureOverlap(payload) >= WINNER_V5_FEATURE_NAMES.length * 0.8) {
    return Object.fromEntries(
      WINNER_V5_FEATURE_NAMES.map((name) => [
        name,
        toFiniteNumber(payload?.[name], WINNER_V5_FEATURE_DEFAULTS[name]),
      ])
    );
  }

  const defaults = { ...WINNER_V5_FEATURE_DEFAULTS };
  const features = { ...defaults };
  const userCategory = inferUserCategory(payload);
  const monthlyIncome = Math.max(1, deriveMonthlyIncome(payload));
  const requestedAmount = toFiniteNumber(payload?.requestedAmount, 0);
  const tenureMonths = Math.max(
    1,
    Math.round(toFiniteNumber(payload?.requestedTenureMonths, 12))
  );
  const requestedEmi = estimateMonthlyEmi(requestedAmount, tenureMonths, 18);
  const existingEmi = Math.max(
    0,
    toFiniteNumber(payload?.totalExistingEmiBurden, 0)
  );
  const totalMonthlyEmi = requestedEmi + existingEmi;
  const householdSize = Math.max(1, toFiniteNumber(payload?.householdSize, 1));
  const childrenCount = Math.max(0, toFiniteNumber(payload?.childrenCount, 0));
  const age = clamp(
    toFiniteNumber(payload?.age, defaults.age_at_application),
    18,
    80
  );
  const hasBankAccount = Boolean(payload?.hasBankAccount);
  const hasUpiHistory = Boolean(payload?.hasUpiHistory);
  const hasExistingLoan =
    String(payload?.hasExistingLoan || "").toLowerCase() === "yes" ||
    Boolean(payload?.hasExistingLoan);
  const maritalStatus = String(payload?.maritalStatus || "").toLowerCase();
  const utilityScore = clamp(
    toFiniteNumber(
      payload?.utilityBillConsistency,
      defaults.utility_payment_score
    ),
    0,
    1
  );
  const upiCount = Math.max(0, toFiniteNumber(payload?.upiTransactionCount, 0));
  const upiVolume = Math.max(
    0,
    toFiniteNumber(payload?.upiTransactionVolume, 0)
  );
  const monthlyTransactionVolume = Math.max(
    0,
    toFiniteNumber(payload?.monthlyTransactionVolume, 0)
  );
  const monthlyRevenue = Math.max(
    0,
    toFiniteNumber(payload?.monthlyRevenue, 0)
  );
  const monthlyExpenses = Math.max(
    0,
    toFiniteNumber(payload?.monthlyExpenses, 0)
  );
  const landSize = Math.max(0, toFiniteNumber(payload?.landSize, 0));
  const collateralValue = Math.max(
    0,
    toFiniteNumber(payload?.collateralValue, 0)
  );
  const savingsAmount = Math.max(0, toFiniteNumber(payload?.savingsAmount, 0));
  const businessAgeMonths = Math.max(
    0,
    toFiniteNumber(payload?.businessAgeMonths, 0)
  );
  const employmentTenureMonths = Math.max(
    0,
    toFiniteNumber(payload?.employmentTenureMonths, 0)
  );
  const monthlySalary = Math.max(
    0,
    toFiniteNumber(payload?.monthlySalaryNet, 0)
  );
  const monthlyAllowance = Math.max(
    0,
    toFiniteNumber(payload?.monthlyAllowance, 0)
  );
  const coApplicantIncome = Math.max(
    0,
    toFiniteNumber(payload?.coApplicantIncome, 0)
  );
  const transactionHistoryUploaded = Boolean(
    payload?.transactionHistoryUploaded
  );
  const docsVerified = Boolean(payload?.docsVerified);

  let incomeStability = defaults.income_stability;
  if (userCategory === "low_income_salaried") {
    incomeStability = clamp(0.72 + employmentTenureMonths / 240, 0.55, 0.95);
  } else if (userCategory === "msme_owner") {
    incomeStability = clamp(0.56 + businessAgeMonths / 240, 0.45, 0.88);
  } else if (userCategory === "farmer") {
    incomeStability = 0.58;
  } else if (userCategory === "gig_worker") {
    incomeStability = 0.54;
  } else if (userCategory === "daily_wage_worker") {
    incomeStability = 0.48;
  } else if (userCategory === "homemaker") {
    incomeStability = clamp(
      coApplicantIncome > 0 || monthlyAllowance > 0 ? 0.62 : 0.5,
      0.45,
      0.8
    );
  }

  // Promote real user-entered stability signals so this feature reacts to
  // actual profile strength instead of remaining mostly category-driven.
  const householdBurden = clamp((householdSize - 1) / 6, 0, 1) * 0.06;
  const childBurden = clamp(childrenCount / 4, 0, 1) * 0.05;
  const emiBurden =
    clamp(existingEmi / Math.max(monthlyIncome, 1), 0, 1) * 0.18;
  const utilityBoost = utilityScore * 0.1;
  const bankingBoost = (hasBankAccount ? 0.04 : 0) + (hasUpiHistory ? 0.03 : 0);
  const inquiryBoost = clamp(upiCount / 120, 0, 1) * 0.03;
  const maritalBoost = maritalStatus === "married" ? 0.02 : 0;
  const existingLoanPenalty = hasExistingLoan && existingEmi <= 0 ? 0.03 : 0;

  incomeStability = clamp(
    incomeStability +
      utilityBoost +
      bankingBoost +
      inquiryBoost +
      maritalBoost -
      householdBurden -
      childBurden -
      emiBurden -
      existingLoanPenalty,
    0.3,
    0.98
  );

  const savingsBufferRatio = clamp(
    savingsAmount > 0
      ? savingsAmount / Math.max(monthlyExpenses || monthlyIncome, 1)
      : Math.max(0, monthlyIncome - monthlyExpenses - existingEmi) /
          Math.max(monthlyExpenses || monthlyIncome, 1),
    0,
    10
  );
  const cashFlowVolatility = clamp(
    1 -
      incomeStability +
      (userCategory === "gig_worker" || userCategory === "daily_wage_worker"
        ? 0.12
        : 0),
    0,
    1
  );
  const transactionConsistency = clamp(
    utilityScore * 0.45 +
      clamp(upiCount / 120, 0, 1) * 0.25 +
      clamp(upiVolume / Math.max(monthlyIncome * 1.2, 1), 0, 1) * 0.2 +
      (transactionHistoryUploaded || monthlyTransactionVolume > 0 ? 0.1 : 0),
    0,
    1
  );
  const spendingPatternRatio = clamp(
    monthlyIncome > 0
      ? 1 - Math.min(0.9, totalMonthlyEmi / monthlyIncome)
      : defaults.spending_pattern_ratio,
    0,
    1
  );

  features.monthly_income = monthlyIncome;
  features.income_stability = incomeStability;
  features.loan_to_income_ratio =
    requestedAmount > 0
      ? requestedAmount / Math.max(monthlyIncome * 12, 1)
      : defaults.loan_to_income_ratio;
  features.emi_to_income_ratio =
    totalMonthlyEmi > 0
      ? totalMonthlyEmi / monthlyIncome
      : defaults.emi_to_income_ratio;
  features.age_at_application = age;
  features.has_bank_account = hasBankAccount ? 1 : 0;
  features.has_upi_history = hasUpiHistory ? 1 : 0;
  features.transaction_consistency = transactionConsistency;
  features.utility_payment_score = utilityScore;
  features.savings_buffer_ratio = savingsBufferRatio;
  features.spending_pattern_ratio = spendingPatternRatio;
  features.cash_flow_volatility = cashFlowVolatility;

  if (userCategory === "daily_wage_worker") {
    const estimatedMonthlyIncome = Math.max(
      monthlyIncome,
      toFiniteNumber(payload?.averageDailyEarnings, 0) *
        Math.max(1, toFiniteNumber(payload?.daysWorkedPerMonth, 22))
    );
    features.estimated_monthly_income = estimatedMonthlyIncome;
    features.income_stability_score = clamp(incomeStability, 0, 1);
    features.work_consistency_score = clamp(transactionConsistency, 0, 1);
  }

  if (userCategory === "gig_worker") {
    features.platform_trust_score = clamp(hasUpiHistory ? 0.62 : 0.42, 0, 1);
    features.num_platforms = clamp(
      toFiniteNumber(payload?.platformCount, 1),
      0,
      5
    );
    features.weekly_income_cv = clamp(cashFlowVolatility * 0.9, 0, 5);
    features.platform_tenure_score = clamp(employmentTenureMonths / 24, 0, 1);
    features.active_day_ratio = clamp(
      toFiniteNumber(payload?.activeDaysPerWeek, 5) / 7,
      0,
      1
    );
  }

  if (userCategory === "msme_owner") {
    const profitMargin =
      monthlyRevenue > 0
        ? (monthlyRevenue - monthlyExpenses) / monthlyRevenue
        : 0;
    features.monthly_revenue = monthlyRevenue;
    features.monthly_expenses = monthlyExpenses;
    features.profit_margin = clamp(profitMargin, -1, 1);
    features.expense_to_revenue_ratio =
      monthlyRevenue > 0 ? monthlyExpenses / monthlyRevenue : 0;
    features.revenue_growth_trend = clamp(
      monthlyTransactionVolume > monthlyRevenue ? 0.15 : 0.0,
      -1,
      2
    );
    features.has_gst = payload?.hasGst ? 1 : 0;
    features.has_udyam = payload?.hasUdyam ? 1 : 0;
    features.is_formalized = payload?.isFormalized ? 1 : 0;
    features.business_age_score = clamp(businessAgeMonths / 36, 0, 1);
  }

  if (userCategory === "farmer") {
    features.land_size = landSize;
    features.land_value_proxy = landSize * 200000;
    features.seasonal_income_flag = 1;
    features.harvest_income_multiplier = 2.5;
    features.irrigation_quality_score = 0.55;
    features.has_kcc = payload?.hasKcc ? 1 : 0;
  }

  if (userCategory === "low_income_salaried") {
    features.monthly_salary = monthlySalary > 0 ? monthlySalary : monthlyIncome;
    features.employment_tenure_score = clamp(employmentTenureMonths / 36, 0, 1);
    features.employment_formalization_score =
      payload?.employerType === "full_time"
        ? 0.82
        : payload?.employerType === "contract"
          ? 0.55
          : defaults.employment_formalization_score;
    features.salary_to_account = hasBankAccount ? 1 : 0;
  }

  if (userCategory === "homemaker") {
    const householdSupport = Math.max(
      monthlyIncome,
      coApplicantIncome / 12,
      monthlyAllowance
    );
    features.monthly_income = householdSupport || features.monthly_income;
    features.has_bank_account = hasBankAccount ? 1 : features.has_bank_account;
  }

  const hasCollateral =
    payload?.collateralType &&
    payload?.collateralType !== "none" &&
    collateralValue > 0;
  features.has_nominee = 0;
  features.nominee_income_ratio = 0;
  features.has_verified_collateral = hasCollateral ? 1 : 0;
  features.collateral_value = collateralValue;
  features.nominee_relationship_score = hasCollateral
    ? 0.35
    : defaults.nominee_relationship_score;

  return Object.fromEntries(
    WINNER_V5_FEATURE_NAMES.map((name) => [
      name,
      toFiniteNumber(features[name], WINNER_V5_FEATURE_DEFAULTS[name]),
    ])
  );
}

function computeRiskLevel(probability) {
  // probability here is repayment probability, not PD.
  // Calibrated bands:
  // low risk   => PD <= 18%
  // medium     => 18% < PD <= 35%
  // high       => PD > 35%
  if (probability >= 0.82) return "low";
  if (probability >= 0.65) return "medium";
  return "high";
}

function computeCreditScore(probability) {
  // Map repayment probability into a conventional credit-score range.
  const mappedScore = Math.round(300 + probability * 550);
  return Math.max(300, Math.min(850, mappedScore));
}

async function resolveArtifactPath() {
  const artifactOverride = process.env.ML_ARTIFACT_PATH;
  if (artifactOverride) {
    const overridePath = path.isAbsolute(artifactOverride)
      ? artifactOverride
      : path.resolve(backendRoot, artifactOverride);
    return overridePath;
  }

  try {
    const manifestPath = process.env.ML_MANIFEST_PATH
      ? path.resolve(backendRoot, process.env.ML_MANIFEST_PATH)
      : DEFAULT_MANIFEST_PATH;

    const manifestRaw = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestRaw);

    if (manifest.artifact_path) {
      const candidate = path.resolve(
        path.dirname(manifestPath),
        manifest.artifact_path
      );
      return candidate;
    }
  } catch (error) {
    // Fall back to default when manifest is not available or invalid.
  }

  return DEFAULT_ARTIFACT_PATH;
}

const degeneracyCache = new Map();

function runRawInference({
  pythonBinary,
  runnerPath,
  artifactPath,
  features,
  timeoutMs,
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBinary, [runnerPath, artifactPath], {
      cwd: backendRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`ML inference timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        return reject(
          new Error(`ml_runner failed with code ${code}: ${stderr || stdout}`)
        );
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) {
          return reject(new Error(parsed.error));
        }
        return resolve(parsed);
      } catch {
        return reject(new Error(`Invalid ml_runner output: ${stdout}`));
      }
    });

    const runnerInput = JSON.stringify({ features });
    child.stdin.write(runnerInput);
    child.stdin.end();
  });
}

function heuristicProbabilityFromPayload(features) {
  const monthlyIncome = toFiniteNumber(
    features?.monthly_income,
    WINNER_V5_FEATURE_DEFAULTS.monthly_income
  );
  const incomeStability = clamp(
    toFiniteNumber(
      features?.income_stability,
      WINNER_V5_FEATURE_DEFAULTS.income_stability
    ),
    0,
    1
  );
  const loanToIncome = Math.max(
    0,
    toFiniteNumber(
      features?.loan_to_income_ratio,
      WINNER_V5_FEATURE_DEFAULTS.loan_to_income_ratio
    )
  );
  const emiToIncome = Math.max(
    0,
    toFiniteNumber(
      features?.emi_to_income_ratio,
      WINNER_V5_FEATURE_DEFAULTS.emi_to_income_ratio
    )
  );
  const transactionConsistency = clamp(
    toFiniteNumber(
      features?.transaction_consistency,
      WINNER_V5_FEATURE_DEFAULTS.transaction_consistency
    ),
    0,
    1
  );
  const utilityScore = clamp(
    toFiniteNumber(
      features?.utility_payment_score,
      WINNER_V5_FEATURE_DEFAULTS.utility_payment_score
    ),
    0,
    1
  );
  const savingsBuffer = Math.max(
    0,
    toFiniteNumber(
      features?.savings_buffer_ratio,
      WINNER_V5_FEATURE_DEFAULTS.savings_buffer_ratio
    )
  );
  const verifiedCollateral =
    toFiniteNumber(features?.has_verified_collateral, 0) > 0 ? 0.05 : 0;
  const formalizationBoost =
    toFiniteNumber(features?.has_gst, 0) > 0 ||
    toFiniteNumber(features?.salary_to_account, 0) > 0
      ? 0.04
      : 0;

  let repaymentProb = 0.48;
  repaymentProb += Math.max(
    -0.2,
    Math.min(0.2, (monthlyIncome - 30000) / 180000)
  );
  repaymentProb += incomeStability * 0.16;
  repaymentProb += transactionConsistency * 0.09;
  repaymentProb += utilityScore * 0.08;
  repaymentProb += Math.min(0.08, savingsBuffer * 0.05);
  repaymentProb += verifiedCollateral + formalizationBoost;
  repaymentProb -= Math.min(0.3, loanToIncome * 0.12);
  repaymentProb -= Math.min(0.22, emiToIncome * 0.3);

  return clamp(repaymentProb, 0.05, 0.95);
}

function computeAffordabilityPenalty(features) {
  const loanToIncome = Math.max(
    0,
    toFiniteNumber(
      features?.loan_to_income_ratio,
      WINNER_V5_FEATURE_DEFAULTS.loan_to_income_ratio
    )
  );
  const emiToIncome = Math.max(
    0,
    toFiniteNumber(
      features?.emi_to_income_ratio,
      WINNER_V5_FEATURE_DEFAULTS.emi_to_income_ratio
    )
  );
  const savingsBuffer = Math.max(
    0,
    toFiniteNumber(
      features?.savings_buffer_ratio,
      WINNER_V5_FEATURE_DEFAULTS.savings_buffer_ratio
    )
  );
  const incomeStability = clamp(
    toFiniteNumber(
      features?.income_stability,
      WINNER_V5_FEATURE_DEFAULTS.income_stability
    ),
    0,
    1
  );

  // Penalize high debt burden while giving a small offset for strong buffers/stability.
  const loanStress = Math.max(0, loanToIncome - 0.4) * 0.12;
  const emiStress = Math.max(0, emiToIncome - 0.22) * 0.65;
  const protectiveOffset = Math.min(
    0.045,
    Math.min(savingsBuffer, 1.2) * 0.018 + incomeStability * 0.018
  );

  return clamp(loanStress + emiStress - protectiveOffset, 0, 0.4);
}

function computePositiveProfileAdjustment(features) {
  const monthlyIncome = Math.max(
    0,
    toFiniteNumber(
      features?.monthly_income,
      WINNER_V5_FEATURE_DEFAULTS.monthly_income
    )
  );
  const monthlySalary = Math.max(
    0,
    toFiniteNumber(
      features?.monthly_salary,
      WINNER_V5_FEATURE_DEFAULTS.monthly_salary
    )
  );
  const incomeStability = clamp(
    toFiniteNumber(
      features?.income_stability,
      WINNER_V5_FEATURE_DEFAULTS.income_stability
    ),
    0,
    1
  );
  const nomineeRelationshipScore = clamp(
    toFiniteNumber(
      features?.nominee_relationship_score,
      WINNER_V5_FEATURE_DEFAULTS.nominee_relationship_score
    ),
    0,
    1
  );
  const hasVerifiedCollateral =
    toFiniteNumber(features?.has_verified_collateral, 0) > 0 ? 1 : 0;
  const collateralValue = Math.max(
    0,
    toFiniteNumber(features?.collateral_value, 0)
  );
  const hasNominee = toFiniteNumber(features?.has_nominee, 0) > 0 ? 1 : 0;

  const incomeBoost = clamp((monthlyIncome - 25000) / 125000, 0, 1) * 0.08;
  const salaryBoost = clamp((monthlySalary - 18000) / 90000, 0, 1) * 0.07;
  const stabilityBoost = clamp((incomeStability - 0.5) / 0.45, 0, 1) * 0.09;
  const relationshipBoost = nomineeRelationshipScore * 0.07;
  const nomineePresenceBoost = hasNominee ? 0.02 : 0;
  const collateralBoost = hasVerifiedCollateral
    ? Math.min(0.07, 0.025 + clamp(collateralValue / 1000000, 0, 1) * 0.045)
    : 0;

  return clamp(
    incomeBoost +
      salaryBoost +
      stabilityBoost +
      relationshipBoost +
      nomineePresenceBoost +
      collateralBoost,
    0,
    0.14
  );
}

async function detectDegenerateModel({
  pythonBinary,
  runnerPath,
  artifactPath,
  timeoutMs,
}) {
  const cacheKey = `${pythonBinary}:${artifactPath}`;
  if (degeneracyCache.has(cacheKey)) {
    return degeneracyCache.get(cacheKey);
  }

  const probeA = {
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

  const probeB = {
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

  try {
    const [a, b] = await Promise.all([
      runRawInference({
        pythonBinary,
        runnerPath,
        artifactPath,
        features: buildFeaturesFromPayload(probeA),
        timeoutMs,
      }),
      runRawInference({
        pythonBinary,
        runnerPath,
        artifactPath,
        features: buildFeaturesFromPayload(probeB),
        timeoutMs,
      }),
    ]);
    const degenerate =
      Math.abs(Number(a.probability) - Number(b.probability)) < 1e-6;
    degeneracyCache.set(cacheKey, degenerate);
    return degenerate;
  } catch {
    degeneracyCache.set(cacheKey, false);
    return false;
  }
}

export async function predictCreditScoreWithModel(payload) {
  const artifactPath = await resolveArtifactPath();
  const runnerPath = path.resolve(__dirname, "ml_runner.py");
  const pythonBinary = process.env.ML_PYTHON_BIN || "python3";
  const timeoutMs = Number(process.env.ML_INFERENCE_TIMEOUT_MS || 10000);

  const features = buildFeaturesFromPayload(payload);
  const parsed = await runRawInference({
    pythonBinary,
    runnerPath,
    artifactPath,
    features,
    timeoutMs,
  });

  const rawDefaultProbability = Number(parsed.probability);
  const isDegenerate = await detectDegenerateModel({
    pythonBinary,
    runnerPath,
    artifactPath,
    timeoutMs,
  });

  const modelRepaymentProbability = isDegenerate
    ? heuristicProbabilityFromPayload(features)
    : clamp(1 - rawDefaultProbability, 0.05, 0.95);
  const positiveProfileAdjustment = computePositiveProfileAdjustment(features);
  const affordabilityPenalty = computeAffordabilityPenalty(features);
  const repaymentProbability = clamp(
    modelRepaymentProbability +
      positiveProfileAdjustment -
      affordabilityPenalty,
    0.05,
    0.95
  );
  const creditScore = computeCreditScore(repaymentProbability);
  const riskLevel = computeRiskLevel(repaymentProbability);

  return {
    creditScore,
    riskLevel,
    probability: repaymentProbability,
    modelInfo: {
      modelType: isDegenerate
        ? "GuardrailHeuristicFromCollapsedModel"
        : parsed.model_type,
      nFeaturesUsed: parsed.n_features_used,
      artifactPath,
      rawProbability: rawDefaultProbability,
      rawDefaultProbability,
      modelRepaymentProbability,
      positiveProfileAdjustment,
      repaymentProbability,
      affordabilityPenalty,
      featureContract: "winner_v5_44_features",
    },
  };
}

export async function getModelReadiness() {
  const artifactPath = await resolveArtifactPath();
  const runnerPath = path.resolve(__dirname, "ml_runner.py");
  const pythonBinary = process.env.ML_PYTHON_BIN || "python3";

  try {
    await fs.access(artifactPath);
    await fs.access(runnerPath);
  } catch (error) {
    return {
      ready: false,
      reason: error.message,
      artifactPath,
      runnerPath,
      pythonBinary,
    };
  }

  return {
    ready: true,
    artifactPath,
    runnerPath,
    pythonBinary,
  };
}
