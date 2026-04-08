/**
 * Runnable checks: vault lookup, merge provenance/fusion, ML feature vector shape,
 * optional full pipeline (requires alternate_risk_pipeline.pkl + Python + shap).
 */
import assert from "node:assert/strict";
import {
  normalizeReferenceId,
  lookupAlternateVault,
  listAlternateVaultKeys,
} from "../src/data/alternateDataVault.js";
import {
  mergeAlternateDataUserAndAdmin,
  runUnbankedScoringPipeline,
} from "../src/services/alternateScoringPipeline.js";
import {
  buildAlternateMlFeatures,
  ALTERNATE_ML_FEATURE_NAMES,
} from "../src/services/alternateFeatureBuilder.js";

function testVault() {
  assert.equal(normalizeReferenceId("aaaaa1111a"), "AAAAA1111A");
  const strong = lookupAlternateVault("AAAAA1111A");
  assert.ok(strong);
  assert.equal(strong.persona, "strong_both");
  assert.ok(strong.upiSummary);
  assert.ok(strong.utilitySummary);
  assert.equal(lookupAlternateVault("EEEEE5555E").persona, "none");
  assert.equal(lookupAlternateVault("CCCCC3333C").utilitySummary, null);
  assert.equal(lookupAlternateVault("DDDDD4444D").upiSummary, null);
  assert.ok(listAlternateVaultKeys().length >= 5);
}

function testMerge() {
  const user = {
    upi: { monthlyInflow: 1000 },
    utility: { paymentRegularity: 0.5 },
    monthsOfHistory: { upi: 2, utility: 2 },
  };
  const admin = {
    source: "admin_vault",
    upi: {
      monthlyInflow: 50000,
      monthsHistory: 8,
    },
    utility: {
      utilityPaymentRegularity: 0.9,
      monthsHistory: 10,
    },
  };
  const m = mergeAlternateDataUserAndAdmin(user, admin);
  assert.equal(m.upi.monthlyInflow, 50000);
  assert.equal(m.utility.paymentRegularity, 0.9);
  assert.equal(m.monthsOfHistory.upi, 8);
  assert.equal(m.monthsOfHistory.utility, 10);
  assert.equal(m.provenance.upiSource, "admin_vault");
  assert.equal(m.provenance.utilitySource, "admin_vault");
}

function testMergeUserCsvProvenance() {
  const m = mergeAlternateDataUserAndAdmin(
    { userSuppliedCsv: true, upi: {} },
    null
  );
  assert.equal(m.provenance.userCsv, "unverified_self_upload");
}

function testFeatureBuilderShape() {
  const minimalUw = {
    normalizedFeaturesSummary: {
      cashflowStability: 0.6,
      paymentDiscipline: 0.7,
      capacityScore: 0.65,
      completenessScore: 0.5,
      historyMonths: 6,
      declaredMonthlyIncome: 30000,
      requestedAmount: 100000,
      fraudRiskScore: 0.2,
      trustScore: 0.8,
      declaredVsObservedGap: 0.1,
    },
    sourceFlags: { hasUpi: true, hasUtility: false },
    completenessScore: 0.5,
    fraudRiskScore: 0.2,
    trustScore: 0.8,
  };
  const f = buildAlternateMlFeatures(minimalUw, {
    requestedAmount: 100000,
    qualityTier: "strong",
    adminAttached: { upi: {}, utility: {} },
    alternateUserSignals: { hasUpiHint: true },
  });
  assert.deepEqual(Object.keys(f).sort(), [...ALTERNATE_ML_FEATURE_NAMES].sort());
}

async function testPipelineWithVaultFusion() {
  const vault = lookupAlternateVault("AAAAA1111A");
  const pipe = await runUnbankedScoringPipeline({
    alternateData: {
      declaredIncome: { monthlyIncome: 25000 },
      monthsOfHistory: {},
      upi: {},
      utility: {},
    },
    adminAttached: {
      source: "admin_vault",
      vaultKey: "AAAAA1111A",
      qualityTier: vault.qualityTier,
      upi: vault.upiSummary,
      utility: vault.utilitySummary,
    },
    requestedAmount: 50000,
    requestedTenure: 12,
    alternateUserSignals: { hasUpiHint: true, hasUtilityHint: true },
    consentAcknowledged: true,
  });
  assert.ok(pipe.alternateUnderwritingDoc.sourceFlags?.hasUpi);
  assert.ok(pipe.alternateUnderwritingDoc.sourceFlags?.hasUtility);
  assert.ok(pipe.alternateUnderwritingDoc.explanationMetadata);
  const score = pipe.decision.creditScore;
  const pd = pipe.decision.probabilityOfDefault;
  const expectedPd = Math.max(0.05, Math.min(0.95, 1 - (score - 300) / 550));
  assert.ok(
    Math.abs(pd - expectedPd) < 1e-6,
    `PD ${pd} must match headline score ${score}`
  );
}

async function main() {
  testVault();
  testMerge();
  testMergeUserCsvProvenance();
  testFeatureBuilderShape();
  try {
    await testPipelineWithVaultFusion();
  } catch (e) {
    if (
      String(e?.message || e).includes("alternate_risk_pipeline.pkl missing") ||
      String(e?.message || e).includes("alternate_ml_runner exit")
    ) {
      console.warn("SKIP pipeline step (artifact/python):", e.message);
    } else {
      throw e;
    }
  }
  console.log("test_alternate_unit: OK");
}

main();
