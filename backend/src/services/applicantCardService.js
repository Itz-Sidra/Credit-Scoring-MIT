/**
 * Applicant Card Service
 *
 * Transforms a raw LoanApplication Mongoose document (+ optional User doc)
 * into a clean, flat ApplicantCard object.
 *
 * The ApplicantCard is the single unit of context for:
 *  - RAG context injection into the LLM
 *  - Chroma vector embedding (via applicant.summary)
 *  - Chat handler payloads
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Read-only transformation — does NOT write back to MongoDB.
 *  - Does NOT import or call any existing scoring, auth, or business logic.
 *  - Does NOT modify LoanApplication or User models.
 *
 * Dependencies (new files only — no existing service touched):
 *  - applicantFactorService.js
 *  - applicantSummaryService.js
 */

import { deriveFactors }   from "./applicantFactorService.js";
import { generateSummary } from "./applicantSummaryService.js";
import {
  probabilityOfDefaultFromBlendedScore,
  riskLevelFromBlendedScore,
} from "../utils/alternateDisplayAlignment.js";

// ─── Safe field extractors ────────────────────────────────────────────────────
const safeNum  = (v) => (typeof v === "number" && !isNaN(v) ? v : null);
const safeStr  = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const safeBool = (v) => (typeof v === "boolean" ? v : null);
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build an ApplicantCard from a LoanApplication document.
 *
 * @param {object} loanDoc  - LoanApplication document (Mongoose doc or plain object)
 * @param {object} [userDoc] - User document (optional — may already be populated on loanDoc.userId)
 * @returns {object} ApplicantCard
 */
export function buildApplicantCard(loanDoc, userDoc = null) {
  // Normalise: work with plain objects so we never accidentally mutate Mongoose docs
  const loan = loanDoc?.toObject ? loanDoc.toObject() : (loanDoc || {});
  const user = userDoc?.toObject ? userDoc.toObject() : userDoc;

  // ── Sub-documents ────────────────────────────────────────────────────────
  const ai         = loan.aiAnalysis  || {};
  const feat       = loan.features    || {};
  const mf         = feat.modelFeatures   || {};
  const ap         = feat.applicantProfile || {};
  const collateral = loan.collateral  || {};
  const altUw = loan.alternateUnderwriting || {};
  const altData = altUw.alternateData || {};
  const declaredAlt = altData.declaredIncome || {};

  // ── Identity ─────────────────────────────────────────────────────────────
  const applicationId  = String(loan._id || "");
  // userId may be a populated object (from .populate()) or a raw ObjectId
  const populatedUser  = (loan.userId && typeof loan.userId === "object" && loan.userId._id)
    ? loan.userId
    : null;
  const resolvedUser   = user || populatedUser;

  const userId          = resolvedUser?._id
    ? String(resolvedUser._id)
    : (loan.userId ? String(loan.userId) : "");
  const applicantName   = safeStr(resolvedUser?.fullName)  || "Unknown";
  const email           = safeStr(resolvedUser?.email)     || null;
  const phone           = safeStr(resolvedUser?.phone)     || null;
  const location        = safeStr(collateral.pincode)      || null;

  // ── Loan basics ───────────────────────────────────────────────────────────
  const loanType        = safeStr(loan.loanType);
  const requestedAmount = safeNum(loan.requestedAmount);
  const requestedTenure = safeNum(loan.requestedTenure);
  const purpose         = safeStr(loan.purpose);
  const status          = safeStr(loan.status);

  // ── Collateral ────────────────────────────────────────────────────────────
  const collateralType  = safeStr(collateral.type)  || "none";
  const collateralValue =
    safeNum(collateral.verifiedValue) ??
    safeNum(collateral.estimatedValue) ??
    0;

  // ── AI Analysis outputs ───────────────────────────────────────────────────
  let creditScore          = safeNum(ai.creditScore) ?? safeNum(resolvedUser?.creditScore) ?? null;
  const eligibleAmount       = safeNum(ai.eligibleAmount);
  const suggestedInterestRate = safeNum(ai.suggestedInterestRate);
  const suggestedTenure      = safeNum(ai.suggestedTenure);
  let riskLevel            = safeStr(ai.riskLevel)  || "medium";
  const amlFlags             = Array.isArray(ai.amlFlags) ? [...ai.amlFlags] : [];
  const modelVersion         = safeStr(ai.modelVersion);
  // SHAP explanation summary (array of strings, if present)
  const shapExplanation      = Array.isArray(ai.shapFactors?.explanationSummary)
    ? ai.shapFactors.explanationSummary
    : null;

  // ── Decision fields ───────────────────────────────────────────────────────
  const scoringSource        = safeStr(feat.scoringSource);
  let probabilityOfDefault = safeNum(feat.probabilityOfDefault);

  if (loan.applicantType === "unbanked" && safeNum(ai.creditScore) != null) {
    const headScore = safeNum(ai.creditScore);
    creditScore = headScore;
    probabilityOfDefault = probabilityOfDefaultFromBlendedScore(headScore);
    riskLevel = riskLevelFromBlendedScore(headScore);
  }
  const preScreenStatus      = safeStr(feat.preScreenStatus);
  const manualReviewRequired = safeBool(feat.manualReviewRequired) ?? false;
  const decision             = safeStr(feat.decision);
  const decisionReason       = safeStr(feat.decisionReason);
  const borrowerType         = safeStr(feat.borrowerType) || safeStr(mf.borrowerType);

  // ── Model feature fields ──────────────────────────────────────────────────
  const userCategory         = safeStr(mf.userCategory);
  const age                  = safeNum(mf.age);
  const gender               = safeStr(mf.gender)      || safeStr(ap.gender)      || safeStr(resolvedUser?.gender);
  const occupation           = safeStr(mf.occupation)  || safeStr(ap.occupation);
  const incomeType           = safeStr(mf.incomeType)  || safeStr(ap.incomeType);

  // Income — pick most specific available source
  const monthlyIncome        =
    safeNum(mf.monthlyIncome) ??
    safeNum(mf.monthlySalaryNet) ??
    (loan.applicantType === "unbanked"
      ? safeNum(declaredAlt.monthlyIncome ?? declaredAlt.monthlyTurnover)
      : null);
  const annualIncomeEstimate = safeNum(mf.annualIncomeEstimate) ?? safeNum(mf.farmerAnnualIncome);
  const householdMonthlyIncome = safeNum(mf.householdMonthlyIncome);
  const monthlyRevenue       = safeNum(mf.monthlyRevenue);
  const monthlyExpenses      = safeNum(mf.monthlyExpenses);
  const totalExistingEmiBurden =
    safeNum(mf.totalExistingEmiBurden) ??
    safeNum(ap.existingEmi) ??
    null;
  const savingsAmount        = safeNum(mf.savingsAmount);

  // ── Digital / banking indicators ──────────────────────────────────────────
  const hasBankAccount             = safeBool(mf.hasBankAccount);
  const hasUpiHistory              = safeBool(mf.hasUpiHistory);
  const transactionHistoryUploaded = safeBool(mf.transactionHistoryUploaded);
  const docsVerified               = safeBool(mf.docsVerified);
  const identityVerified           = safeBool(mf.identityVerified) ?? safeBool(ap.identityVerified);
  const salaryCreditedToBank       = safeBool(mf.salaryCreditedToBank);
  const upiTransactionCount        = safeNum(mf.upiTransactionCount);
  const upiTransactionVolume       = safeNum(mf.upiTransactionVolume);

  // ── Business-specific ────────────────────────────────────────────────────
  const hasGst            = safeBool(mf.hasGst);
  const hasUdyam          = safeBool(mf.hasUdyam);
  const businessAgeMonths = safeNum(mf.businessAgeMonths);

  // ── Timestamps ────────────────────────────────────────────────────────────
  const createdAt = loan.submittedAt || loan.createdAt || null;

  // ── Assemble partial card for factor derivation ───────────────────────────
  const partial = {
    applicationId,
    userId,
    applicantName,
    email,
    phone,
    location,
    loanType,
    requestedAmount,
    requestedTenure,
    purpose,
    collateralType,
    collateralValue,
    creditScore,
    eligibleAmount,
    suggestedInterestRate,
    suggestedTenure,
    riskLevel,
    probabilityOfDefault,
    decision,
    status,
    preScreenStatus,
    manualReviewRequired,
    decisionReason,
    amlFlags,
    modelVersion,
    scoringSource,
    shapExplanation,
    userCategory,
    borrowerType,
    age,
    gender,
    occupation,
    incomeType,
    monthlyIncome,
    annualIncomeEstimate,
    householdMonthlyIncome,
    monthlyRevenue,
    monthlyExpenses,
    totalExistingEmiBurden,
    savingsAmount,
    hasBankAccount,
    hasUpiHistory,
    upiTransactionCount,
    upiTransactionVolume,
    transactionHistoryUploaded,
    docsVerified,
    identityVerified,
    salaryCreditedToBank,
    hasGst,
    hasUdyam,
    businessAgeMonths,
    createdAt,
  };

  // ── Rule-based factors (deterministic, no LLM) ────────────────────────────
  const { topPositiveFactors, topNegativeFactors } = deriveFactors(partial);

  const withFactors = { ...partial, topPositiveFactors, topNegativeFactors };

  // ── Human-readable summary (for Chroma embedding) ────────────────────────
  const summary = generateSummary(withFactors);

  return { ...withFactors, summary };
}
