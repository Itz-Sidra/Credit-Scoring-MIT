/**
 * Applicant Summary Service
 *
 * Generates a clean, human-readable, professional summary paragraph
 * for an ApplicantCard.
 *
 * This string becomes the embedded document in Chroma (Phase 6).
 * It must be rich enough to support semantic search but must NEVER
 * include invented or inferred data.
 *
 * Contract: pure function — no I/O, no DB, no LLM, no side effects.
 */

/**
 * @param {object} card - ApplicantCard with factors already set
 * @returns {string} - human-readable summary paragraph
 */
export function generateSummary(card) {
  const sentences = [];

  const name       = card.applicantName || "Unknown Applicant";
  const loanType   = card.loanType ? card.loanType.replace("_", " ") : "unspecified";
  const amount     = card.requestedAmount != null
    ? `₹${Number(card.requestedAmount).toLocaleString()}`
    : "an unspecified amount";
  const tenure     = card.requestedTenure != null
    ? `${card.requestedTenure} months`
    : "an unspecified tenure";
  const status     = card.status     || "unknown";
  const risk       = card.riskLevel  || "unknown";
  const decision   = card.decision   || "pending";
  const pd         = typeof card.probabilityOfDefault === "number"
    ? `${(card.probabilityOfDefault * 100).toFixed(1)}%`
    : "not available";
  const creditStr  = card.creditScore != null ? String(card.creditScore) : "not available";
  const eligible   = card.eligibleAmount != null
    ? `₹${Number(card.eligibleAmount).toLocaleString()}`
    : "not determined";

  // ── Opening ────────────────────────────────────────────────────────────────
  sentences.push(
    `${name} applied for a ${loanType} loan of ${amount} over ${tenure}. ` +
    `Current application status is ${status}.`
  );

  // ── Scoring output ────────────────────────────────────────────────────────
  sentences.push(
    `The ML scoring model assigned a credit score of ${creditStr}, ` +
    `a ${risk} risk level, and a probability of default of ${pd}. ` +
    `System decision: ${decision}. Eligible amount: ${eligible}.`
  );

  // ── Decision reason ───────────────────────────────────────────────────────
  if (card.decisionReason) {
    sentences.push(`Decision rationale: ${card.decisionReason}.`);
  }

  // ── Income & profile ──────────────────────────────────────────────────────
  const primaryIncome =
    card.monthlyIncome         != null ? { val: card.monthlyIncome,        label: "monthly income" } :
    card.householdMonthlyIncome != null ? { val: card.householdMonthlyIncome, label: "household monthly income" } :
    card.annualIncomeEstimate   != null ? { val: card.annualIncomeEstimate,  label: "annual income estimate" } :
    null;

  if (primaryIncome) {
    sentences.push(
      `Applicant reports a ${primaryIncome.label} of ₹${Number(primaryIncome.val).toLocaleString()}.`
    );
  }

  if (card.occupation || card.incomeType) {
    const occ    = card.occupation  ? `Occupation: ${card.occupation}.`   : "";
    const itype  = card.incomeType  ? ` Income type: ${card.incomeType}.` : "";
    sentences.push((occ + itype).trim());
  }

  if (card.age) {
    sentences.push(`Applicant age: ${card.age} years.`);
  }

  if (card.borrowerType) {
    sentences.push(`Borrower category: ${card.borrowerType}.`);
  }

  // ── Digital & banking footprint ───────────────────────────────────────────
  const footprint = [];
  if (card.hasBankAccount === true)        footprint.push("holds a bank account");
  if (card.hasUpiHistory === true)         footprint.push("has active UPI history");
  if (card.salaryCreditedToBank === true)  footprint.push("salary credited to bank");
  if (card.transactionHistoryUploaded === true) footprint.push("transaction history uploaded");
  if (card.docsVerified === true)          footprint.push("documents verified");
  if (card.identityVerified === true)      footprint.push("identity verified via OCR");

  if (footprint.length > 0) {
    sentences.push(`Financial footprint: ${footprint.join(", ")}.`);
  }

  if (card.upiTransactionCount != null && card.upiTransactionCount > 0) {
    sentences.push(`UPI transaction count: ${card.upiTransactionCount}.`);
  }

  // ── EMI burden ────────────────────────────────────────────────────────────
  if (card.totalExistingEmiBurden != null && card.totalExistingEmiBurden > 0) {
    sentences.push(
      `Existing EMI burden: ₹${Number(card.totalExistingEmiBurden).toLocaleString()} per month.`
    );
  }

  // ── Collateral ────────────────────────────────────────────────────────────
  if (
    card.collateralType &&
    card.collateralType !== "none" &&
    card.collateralValue > 0
  ) {
    sentences.push(
      `Collateral offered: ${card.collateralType} valued at ₹${Number(card.collateralValue).toLocaleString()}.`
    );
  } else {
    sentences.push("No collateral provided — unsecured application.");
  }

  // ── Purpose ───────────────────────────────────────────────────────────────
  if (card.purpose) {
    sentences.push(`Stated loan purpose: ${card.purpose}.`);
  }

  // ── AML flags ─────────────────────────────────────────────────────────────
  if (Array.isArray(card.amlFlags) && card.amlFlags.length > 0) {
    sentences.push(`AML/compliance flags: ${card.amlFlags.join(", ")}.`);
  }

  // ── Business-specific ────────────────────────────────────────────────────
  if (card.loanType === "business") {
    const biz = [];
    if (card.hasGst === true)   biz.push("GST registered");
    if (card.hasUdyam === true) biz.push("UDYAM registered");
    if (card.businessAgeMonths != null) {
      biz.push(`business operational for ${card.businessAgeMonths} months`);
    }
    if (card.monthlyRevenue != null) {
      biz.push(`monthly revenue ₹${Number(card.monthlyRevenue).toLocaleString()}`);
    }
    if (biz.length > 0) {
      sentences.push(`Business profile: ${biz.join(", ")}.`);
    }
  }

  // ── Pre-screen ────────────────────────────────────────────────────────────
  if (card.preScreenStatus) {
    sentences.push(`Pre-screen result: ${card.preScreenStatus}.`);
  }

  // ── Top factors (short version) ───────────────────────────────────────────
  if (card.topPositiveFactors && card.topPositiveFactors.length > 0) {
    sentences.push(`Key strength: ${card.topPositiveFactors[0]}.`);
  }
  if (card.topNegativeFactors && card.topNegativeFactors.length > 0) {
    sentences.push(`Key concern: ${card.topNegativeFactors[0]}.`);
  }

  return sentences.join(" ");
}
