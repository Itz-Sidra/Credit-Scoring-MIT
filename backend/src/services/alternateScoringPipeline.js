import {
  buildAlternateUnderwriting,
} from "./alternateUnderwritingEngine.js";
import {
  buildAlternateMlFeatures,
} from "./alternateFeatureBuilder.js";
import { predictAlternateRisk } from "./alternateMlService.js";
import {
  probabilityOfDefaultFromBlendedScore,
  riskLevelFromBlendedScore,
} from "../utils/alternateDisplayAlignment.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Merge user alternate payload with admin-attached verified summaries.
 * Admin fields override overlapping cashflow signals.
 */
export function mergeAlternateDataUserAndAdmin(userAlt, adminAttached) {
  const base = JSON.parse(JSON.stringify(userAlt || {}));
  base.monthsOfHistory = base.monthsOfHistory || {};
  base.upi = base.upi || {};
  base.utility = base.utility || {};
  base.provenance = base.provenance || {};
  if (userAlt?.userSuppliedCsv) {
    base.provenance.userCsv = "unverified_self_upload";
  }

  if (adminAttached?.upi) {
    const u = adminAttached.upi;
    base.upi = {
      ...base.upi,
      monthlyInflow: u.monthlyInflow ?? base.upi.monthlyInflow,
      monthlyOutflow: u.monthlyOutflow ?? base.upi.monthlyOutflow,
      avgMonthlyTransactionCount:
        u.avgMonthlyTransactionCount ?? base.upi.avgMonthlyTransactionCount,
      transactionRegularity:
        u.transactionRegularity ?? base.upi.transactionRegularity,
    };
    if (u.monthsHistory != null) {
      base.monthsOfHistory.upi = Math.max(
        base.monthsOfHistory.upi || 0,
        u.monthsHistory
      );
    }
    base.provenance.upiSource = adminAttached.source || "admin_vault";
  }

  if (adminAttached?.utility) {
    const ut = adminAttached.utility;
    const reg =
      ut.utilityPaymentRegularity ?? ut.paymentRegularity ?? base.utility.paymentRegularity;
    base.utility = {
      ...base.utility,
      paymentRegularity: reg,
    };
    if (ut.monthsHistory != null) {
      base.monthsOfHistory.utility = Math.max(
        base.monthsOfHistory.utility || 0,
        ut.monthsHistory
      );
    }
    base.provenance.utilitySource = adminAttached.source || "admin_vault";
  }

  return base;
}

function heuristicPdFromScore(score) {
  return clamp(1 - (score - 300) / 550, 0.05, 0.95);
}

function blendScores(heuristicUw, mlPd) {
  const hPd = heuristicPdFromScore(heuristicUw.score);
  const ml = mlPd != null ? mlPd : hPd;
  const blendedPd = 0.45 * ml + 0.55 * hPd;
  const blendedScore = Math.round(300 + (1 - blendedPd) * 550);
  return { blendedPd, blendedScore, hPd, mlUsed: mlPd != null };
}

function buildModelFeaturesPatch(underwriting) {
  const s = underwriting.normalizedFeaturesSummary;
  return {
    userCategory: "unbanked_alt",
    hasBankAccount: false,
    hasUpiHistory: Boolean(underwriting.sourceFlags?.hasUpi),
    utilityBillConsistency: s?.paymentDiscipline ?? 0,
    upiTransactionCount: s?.avgMonthlyTransactionCount ?? 0,
    upiTransactionVolume: s?.avgMonthlyInflow ?? 0,
    annualIncomeEstimate: (s?.declaredMonthlyIncome || 0) * 12,
  };
}

/**
 * Full unbanked scoring: deterministic layer + optional alternate ML + hybrid PD.
 */
export async function runUnbankedScoringPipeline({
  alternateData,
  adminAttached = null,
  requestedAmount,
  requestedTenure,
  alternateUserSignals = null,
  consentAcknowledged = true,
}) {
  if (alternateData && typeof alternateData === "object") {
    alternateData = { ...alternateData, _consentAcknowledged: consentAcknowledged };
  }
  const merged = mergeAlternateDataUserAndAdmin(alternateData, adminAttached);
  const underwriting = buildAlternateUnderwriting(
    merged,
    requestedAmount,
    requestedTenure
  );

  const qualityTier =
    adminAttached?.qualityTier != null ? adminAttached.qualityTier : "medium";

  const featureCtx = {
    adminAttached,
    requestedAmount,
    qualityTier,
    alternateUserSignals: alternateUserSignals || {},
  };
  const mlFeatures = buildAlternateMlFeatures(underwriting, featureCtx);

  let mlResult = null;
  try {
    mlResult = await predictAlternateRisk(mlFeatures);
  } catch (e) {
    mlResult = { error: String(e?.message || e), fallback: true };
  }

  const mlPd =
    mlResult &&
    !mlResult.fallback &&
    typeof mlResult.probability_default === "number"
      ? mlResult.probability_default
      : null;

  const { blendedPd, blendedScore, mlUsed } = blendScores(underwriting, mlPd);
  const displayProbabilityOfDefault =
    probabilityOfDefaultFromBlendedScore(blendedScore);

  const riskBand = riskLevelFromBlendedScore(blendedScore);

  const hasSevere = underwriting.fraudRiskScore >= 0.75;
  const decision =
    blendedScore >= 720 &&
    underwriting.confidenceLevel === "high" &&
    underwriting.fraudRiskScore < 0.4
      ? "approve"
      : hasSevere &&
          underwriting.normalizedFeaturesSummary.historyMonths >= 6 &&
          blendedScore < 540
        ? "reject"
        : "review";
  const status = decision === "reject" ? "auto_rejected" : "under_review";

  const scoringMethod = mlUsed ? "alternate_hybrid_ml_v1" : "alternate_feature_blend";
  const scoringVersion = "alt_v2";

  const decisionLayer = {
    creditScore: blendedScore,
    probabilityOfDefault: displayProbabilityOfDefault,
    riskLevel: riskBand,
    eligibleAmount:
      decision === "approve"
        ? requestedAmount
        : Math.round(Number(requestedAmount) * 0.7),
    suggestedInterestRate:
      riskBand === "low" ? 11.5 : riskBand === "medium" ? 14.25 : 18.75,
    suggestedTenure: requestedTenure,
    decision:
      decision === "approve" ? "Approve" : decision === "reject" ? "Reject" : "Hold",
    status,
    decisionReason: `alternate_${scoringMethod}:${underwriting.reasons.join("|")}`,
  };

  delete merged._consentAcknowledged;

  const explanationMetadata = {
    consentAcknowledged: Boolean(consentAcknowledged),
    trustScore: underwriting.trustScore,
    fraudRiskScore: underwriting.fraudRiskScore,
    ml: mlResult
      ? {
          probability_default: mlResult.probability_default ?? null,
          n_features: mlResult.n_features_used ?? null,
          error: mlResult.error ?? null,
        }
      : null,
    shap: mlResult?.shap ?? null,
    hybrid: {
      heuristic_pd: heuristicPdFromScore(underwriting.score),
      ml_pd: mlPd,
      blended_pd_internal: blendedPd,
      blended_pd: displayProbabilityOfDefault,
      ml_used: mlUsed,
    },
    mergedProvenance: merged.provenance || {},
  };

  const alternateUnderwritingDoc = {
    sourceFlags: underwriting.sourceFlags,
    alternateData: merged,
    trustScore: underwriting.trustScore,
    fraudRiskScore: underwriting.fraudRiskScore,
    dataCompletenessScore: underwriting.completenessScore,
    alternateRiskScore: blendedScore,
    confidenceLevel: underwriting.confidenceLevel,
    reliabilityFlag: underwriting.reliabilityFlag,
    scoringMethod,
    scoringVersion,
    decision,
    riskBand,
    reasons: underwriting.reasons,
    warnings: underwriting.warnings,
    normalizedFeaturesSummary: underwriting.normalizedFeaturesSummary,
    explanationMetadata,
    heuristicBaselineScore: underwriting.score,
    mlFeatureVector: mlFeatures,
  };

  if (
    adminAttached &&
    (adminAttached.upi != null || adminAttached.utility != null)
  ) {
    alternateUnderwritingDoc.adminAttached = {
      upi: adminAttached.upi ?? null,
      utility: adminAttached.utility ?? null,
      source: adminAttached.source ?? null,
      vaultKey: adminAttached.vaultKey ?? null,
      qualityTier: adminAttached.qualityTier ?? null,
      attachedAt: adminAttached.attachedAt ?? new Date(),
      attachedBy: adminAttached.attachedBy ?? null,
    };
  }

  return {
    underwriting,
    mergedAlternateData: merged,
    decision: decisionLayer,
    alternateUnderwritingDoc,
    modelFeaturesPatch: buildModelFeaturesPatch(underwriting),
    scoringSource: scoringMethod,
    preScreenWarnings: [...underwriting.warnings],
    mlRaw: mlResult,
  };
}

/**
 * Apply scoring pipeline output to a persisted LoanApplication (admin re-score).
 */
export function applyUnbankedPipelineResultToLoan(loan, pipe) {
  const alt = pipe.alternateUnderwritingDoc;
  loan.alternateUnderwriting = {
    ...alt,
    explanationMetadata: {
      ...(alt.explanationMetadata || {}),
      rescoreAt: new Date(),
    },
  };
  loan.aiAnalysis = loan.aiAnalysis || {};
  loan.aiAnalysis.creditScore = pipe.decision.creditScore;
  loan.aiAnalysis.riskLevel = pipe.decision.riskLevel;
  loan.aiAnalysis.eligibleAmount = pipe.decision.eligibleAmount;
  loan.aiAnalysis.suggestedInterestRate = pipe.decision.suggestedInterestRate;
  loan.aiAnalysis.suggestedTenure = pipe.decision.suggestedTenure;
  const shapLines = [];
  if (alt.explanationMetadata?.shap?.topFeatures?.length) {
    shapLines.push("alternate_model_shap_top:");
    alt.explanationMetadata.shap.topFeatures.slice(0, 8).forEach((t) => {
      shapLines.push(`  ${t.name} (shap=${t.shapValue})`);
    });
  }
  loan.aiAnalysis.shapFactors = {
    explanationSummary: [
      pipe.decision.decisionReason,
      `scoringSource=${pipe.scoringSource}`,
      ...shapLines,
    ],
  };
  loan.features = loan.features || {};
  loan.features.scoringSource = pipe.scoringSource;
  loan.features.probabilityOfDefault = pipe.decision.probabilityOfDefault;
  loan.features.decision = pipe.decision.decision;
  loan.features.decisionReason = pipe.decision.decisionReason;
  loan.features.alternateWarnings = alt.warnings || [];
  loan.features.alternateConfidence = alt.confidenceLevel;
  loan.features.alternateReliabilityFlag = alt.reliabilityFlag;
  loan.features.modelFeatures = {
    ...(loan.features.modelFeatures || {}),
    ...pipe.modelFeaturesPatch,
  };
  loan.status = pipe.decision.status;
}
