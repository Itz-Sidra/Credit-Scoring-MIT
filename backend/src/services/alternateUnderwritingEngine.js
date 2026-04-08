/**
 * Deterministic alternate underwriting (unbanked baseline) + payload validation.
 * Banked winner_v5 path does not use this module.
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNonNegativeNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

export function buildAlternateUnderwriting(alt = {}, requestedAmount, requestedTenure) {
  const monthsUpi = toNonNegativeNumber(alt?.monthsOfHistory?.upi);
  const monthsGst = toNonNegativeNumber(alt?.monthsOfHistory?.gst);
  const monthsUtility = toNonNegativeNumber(alt?.monthsOfHistory?.utility);
  const monthsRent = toNonNegativeNumber(alt?.monthsOfHistory?.rent);

  const avgInflow = toNonNegativeNumber(alt?.upi?.monthlyInflow);
  const avgOutflow = toNonNegativeNumber(alt?.upi?.monthlyOutflow);
  const txCount = toNonNegativeNumber(alt?.upi?.avgMonthlyTransactionCount);
  const txRegularity = clamp(
    toNonNegativeNumber(alt?.upi?.transactionRegularity, 0.5),
    0,
    1
  );
  const inflowVariance = clamp(
    toNonNegativeNumber(alt?.upi?.inflowVariance, 0.35),
    0,
    2
  );

  const gstConsistency = clamp(
    toNonNegativeNumber(alt?.gst?.filingConsistency, 0.5),
    0,
    1
  );
  const utilityRegularity = clamp(
    toNonNegativeNumber(alt?.utility?.paymentRegularity, 0.5),
    0,
    1
  );
  const rentRegularity = clamp(
    toNonNegativeNumber(alt?.rent?.paymentConsistency, 0.5),
    0,
    1
  );

  const declaredIncome = toNonNegativeNumber(
    alt?.declaredIncome?.monthlyIncome || alt?.declaredIncome?.monthlyTurnover
  );
  const employmentType = String(alt?.employmentType || "").toLowerCase();
  const hasCashflow = avgInflow > 0 || declaredIncome > 0;

  const stabilityFromVariance = clamp(1 - inflowVariance / 1.5, 0, 1);
  const cashflowStability = clamp(
    txRegularity * 0.45 + stabilityFromVariance * 0.35 + (txCount >= 25 ? 0.2 : txCount / 125),
    0,
    1
  );
  const paymentDiscipline = clamp(
    utilityRegularity * 0.45 + gstConsistency * 0.35 + rentRegularity * 0.2,
    0,
    1
  );

  const effectiveIncome = Math.max(declaredIncome, avgInflow);
  const affordability = clamp(
    effectiveIncome > 0 ? requestedAmount / Math.max(1, effectiveIncome * 18) : 1.1,
    0,
    2
  );
  const capacityScore = clamp(1 - affordability * 0.7, 0, 1);
  const historyMonths = Math.max(monthsUpi, monthsGst, monthsUtility, monthsRent);
  const historyScore = clamp(historyMonths / 12, 0, 1);

  const sourceFlags = {
    hasUpi: monthsUpi > 0,
    hasGst: monthsGst > 0,
    hasUtility: monthsUtility > 0,
    hasRent: monthsRent > 0,
    hasDeclaredIncome: declaredIncome > 0,
  };
  const availableSources = Object.values(sourceFlags).filter(Boolean).length;
  const completenessScore = clamp(
    availableSources * 0.14 + historyScore * 0.3 + (hasCashflow ? 0.2 : 0),
    0,
    1
  );

  const riskPenalty =
    (historyMonths < 3 ? 0.18 : 0) +
    (cashflowStability < 0.35 ? 0.12 : 0) +
    (paymentDiscipline < 0.35 ? 0.12 : 0);

  const blendedStrength = clamp(
    cashflowStability * 0.35 +
      paymentDiscipline * 0.3 +
      capacityScore * 0.2 +
      completenessScore * 0.15 -
      riskPenalty,
    0,
    1
  );

  const score = Math.round(300 + blendedStrength * 550);
  const riskBand = score >= 700 ? "low" : score >= 590 ? "medium" : "high";
  const confidenceLevel =
    completenessScore >= 0.75 ? "high" : completenessScore >= 0.5 ? "medium" : "low";
  const reliabilityFlag =
    completenessScore >= 0.75
      ? "sufficient_data"
      : completenessScore >= 0.45
        ? "partial_data"
        : "insufficient_data";

  const warnings = [];
  if (historyMonths < 6) warnings.push("limited_history_window");
  if (availableSources < 2) warnings.push("few_alternate_sources");
  if (!hasCashflow) warnings.push("cashflow_signals_missing");
  if (inflowVariance > 1.1) warnings.push("high_cashflow_variance");
  const declaredVsObservedGap =
    declaredIncome > 0 && avgInflow > 0
      ? Math.abs(declaredIncome - avgInflow) / Math.max(1, declaredIncome)
      : 0;
  if (declaredVsObservedGap > 0.45) {
    warnings.push("declared_income_mismatch");
  }
  const circularityProxy =
    avgInflow > 0 ? clamp(avgOutflow / Math.max(1, avgInflow), 0, 2) : 1.2;
  if (circularityProxy > 0.95 && txCount > 40) {
    warnings.push("possible_round_tripping_pattern");
  }

  const reasons = [
    `cashflow_stability=${cashflowStability.toFixed(2)}`,
    `payment_discipline=${paymentDiscipline.toFixed(2)}`,
    `capacity_score=${capacityScore.toFixed(2)}`,
    `completeness=${completenessScore.toFixed(2)}`,
  ];

  const trustScore = clamp(
    1 -
      (declaredVsObservedGap * 0.35 +
        Math.max(0, circularityProxy - 0.85) * 0.35 +
        (historyMonths < 6 ? 0.15 : 0) +
        (availableSources < 2 ? 0.15 : 0)),
    0,
    1
  );
  const fraudRiskScore = clamp(
    declaredVsObservedGap * 0.45 +
      Math.max(0, circularityProxy - 0.85) * 0.35 +
      (inflowVariance > 1.1 ? 0.12 : 0) +
      (historyMonths < 3 ? 0.18 : 0),
    0,
    1
  );

  const hasSevereNegativeSignals =
    (cashflowStability < 0.2 && paymentDiscipline < 0.2) ||
    fraudRiskScore >= 0.75 ||
    (declaredVsObservedGap > 0.7 && txCount > 30);
  const hasSufficientHistoryForHardDecision =
    historyMonths >= 6 || availableSources >= 3;

  const decision =
    score >= 720 && confidenceLevel === "high" && fraudRiskScore < 0.4
      ? "approve"
      : hasSevereNegativeSignals && hasSufficientHistoryForHardDecision && score < 540
        ? "reject"
        : "review";
  const status = decision === "reject" ? "auto_rejected" : "under_review";

  return {
    applicantType: "unbanked",
    score,
    riskBand,
    decision,
    status,
    confidenceLevel,
    reliabilityFlag,
    sourceFlags,
    completenessScore,
    warnings,
    reasons,
    employmentType: employmentType || null,
    normalizedFeaturesSummary: {
      cashflowStability,
      paymentDiscipline,
      capacityScore,
      completenessScore,
      historyMonths,
      avgMonthlyInflow: avgInflow,
      avgMonthlyOutflow: avgOutflow,
      avgMonthlyTransactionCount: txCount,
      requestedAmount: Number(requestedAmount || 0),
      requestedTenure: Number(requestedTenure || 0),
      employmentType: employmentType || null,
      declaredMonthlyIncome: declaredIncome,
      declaredVsObservedGap,
      circularityProxy,
      trustScore,
      fraudRiskScore,
    },
    trustScore,
    fraudRiskScore,
  };
}

export function validateAlternateDataPayload(alt = {}, options = {}) {
  const errors = [];
  const quickApply = Boolean(alt?.quickApply);
  const monthlyInflow = toNonNegativeNumber(alt?.upi?.monthlyInflow, -1);
  const monthlyOutflow = toNonNegativeNumber(alt?.upi?.monthlyOutflow, -1);
  const txCount = toNonNegativeNumber(alt?.upi?.avgMonthlyTransactionCount, -1);
  const declaredMonthlyIncome = toNonNegativeNumber(
    alt?.declaredIncome?.monthlyIncome || alt?.declaredIncome?.monthlyTurnover,
    -1
  );
  const monthsUpi = toNonNegativeNumber(alt?.monthsOfHistory?.upi, -1);
  const monthsUtility = toNonNegativeNumber(alt?.monthsOfHistory?.utility, -1);

  const refOk = String(options.referenceId || "").trim().length >= 4;

  if (monthlyInflow < 0 && declaredMonthlyIncome < 0) {
    errors.push("Provide monthly UPI inflow or declared monthly income");
  }
  if (!quickApply && monthlyOutflow < 0) {
    errors.push("Provide monthly UPI outflow summary");
  }
  if (!quickApply && txCount < 0) {
    errors.push("Provide average monthly transaction count");
  }
  if (monthsUpi < 0 && monthsUtility < 0 && !refOk) {
    errors.push(
      "Provide months of history for at least one alternate source, or a valid reference ID (PAN / bank reference)"
    );
  }
  return errors;
}
