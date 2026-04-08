import axios from "axios";

const API_URL = process.env.API_URL || "http://localhost:8000/api";
const TOKEN = process.env.TEST_USER_TOKEN;

async function run() {
  if (!TOKEN) {
    throw new Error("TEST_USER_TOKEN is required");
  }

  const payload = {
    applicantType: "unbanked",
    alternateReferenceId: process.env.TEST_ALTERNATE_REF || "AAAAA1111A",
    alternateReferenceIdType: "pan",
    alternateUserSignals: { hasUpiHint: true, hasUtilityHint: true },
    alternateDataConsent: true,
    loanType: "personal",
    requestedAmount: 60000,
    requestedTenure: 12,
    purpose: "Working capital",
    age: 29,
    applicantProfile: {
      occupation: "Self-employed",
      incomeAnnual: 360000,
      incomeType: "Commercial associate",
      gender: "male",
      maritalStatus: "single",
      hasExistingLoan: "no",
    },
    alternateData: {
      upi: {
        monthlyInflow: 42000,
        monthlyOutflow: 28000,
        avgMonthlyTransactionCount: 78,
        transactionRegularity: 0.76,
        inflowVariance: 0.35,
      },
      gst: { filingConsistency: 0.72 },
      utility: { paymentRegularity: 0.84 },
      rent: { paymentConsistency: 0.8 },
      monthsOfHistory: { upi: 12, gst: 8, utility: 10, rent: 9 },
      declaredIncome: { monthlyIncome: 40000 },
      employmentType: "small_business_owner",
    },
  };

  const response = await axios.post(`${API_URL}/loan/apply`, payload, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const output = response.data?.decisionOutput || {};

  console.log("status:", response.status);
  console.log("applicant_type:", output.applicant_type);
  console.log("underwriting_path:", output.underwriting_path);
  console.log("decision:", output.decision);
  console.log("risk_band:", output.risk_band);
  console.log("confidence:", output.confidence);
}

run().catch((error) => {
  if (error.response) {
    console.error("status:", error.response.status);
    console.error("data:", JSON.stringify(error.response.data, null, 2));
  } else {
    console.error(error.message);
  }
  process.exit(1);
});
