import { tierRank } from "../data/alternateDataVault.js";

function clamp(x, a, b) {
  return Math.min(b, Math.max(a, x));
}

/**
 * Feature dict for alternate_risk sklearn model (must match train_alternate_model.py FEATURE_NAMES).
 */
export function buildAlternateMlFeatures(underwriting, ctx = {}) {
  const s = underwriting.normalizedFeaturesSummary || {};
  const flags = underwriting.sourceFlags || {};
  const admin = ctx.adminAttached || {};
  const hasAdminUpi = admin.upi != null && typeof admin.upi === "object" ? 1 : 0;
  const hasAdminUtility =
    admin.utility != null && typeof admin.utility === "object" ? 1 : 0;

  const effectiveIncome = Math.max(
    Number(s.declaredMonthlyIncome || 0),
    Number(s.avgMonthlyInflow || 0),
    1
  );
  const loanToIncome = clamp(
    Number(s.requestedAmount || ctx.requestedAmount || 0) /
      Math.max(1, effectiveIncome * 18),
    0,
    3
  );

  const qTier = ctx.qualityTier != null ? tierRank(ctx.qualityTier) : 1;

  return {
    cashflow_stability: Number(s.cashflowStability ?? 0.5),
    payment_discipline: Number(s.paymentDiscipline ?? 0.5),
    capacity_score: Number(s.capacityScore ?? 0.5),
    completeness_score: Number(s.completenessScore ?? underwriting.completenessScore ?? 0.5),
    history_months_norm: clamp(Number(s.historyMonths || 0) / 12, 0, 1),
    has_upi: flags.hasUpi ? 1 : 0,
    has_utility: flags.hasUtility ? 1 : 0,
    has_admin_upi: hasAdminUpi,
    has_admin_utility: hasAdminUtility,
    quality_tier: qTier,
    loan_to_income_ratio: loanToIncome,
    fraud_risk: Number(s.fraudRiskScore ?? underwriting.fraudRiskScore ?? 0),
    trust_score: Number(s.trustScore ?? underwriting.trustScore ?? 0.5),
    declared_gap: Number(s.declaredVsObservedGap ?? 0),
    hint_upi: ctx.alternateUserSignals?.hasUpiHint ? 1 : 0,
    hint_utility: ctx.alternateUserSignals?.hasUtilityHint ? 1 : 0,
  };
}

export const ALTERNATE_ML_FEATURE_NAMES = [
  "cashflow_stability",
  "payment_discipline",
  "capacity_score",
  "completeness_score",
  "history_months_norm",
  "has_upi",
  "has_utility",
  "has_admin_upi",
  "has_admin_utility",
  "quality_tier",
  "loan_to_income_ratio",
  "fraud_risk",
  "trust_score",
  "declared_gap",
  "hint_upi",
  "hint_utility",
];
