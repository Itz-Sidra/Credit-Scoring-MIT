/**
 * Applicant Factor Service
 *
 * Derives topPositiveFactors and topNegativeFactors from a partial
 * ApplicantCard using DETERMINISTIC RULE-BASED logic only.
 *
 * Purpose: grounded factor labels for LLM context injection.
 * Contract: pure function — no I/O, no DB, no LLM, no side effects.
 */

// ─── Thresholds ───────────────────────────────────────────────────────────────
const PD_LOW = 0.2;
const PD_HIGH = 0.5;
const CREDIT_GOOD = 700;
const CREDIT_POOR = 580;
const EMI_LOAD_HIGH = 0.5;   // EMI > 50% of monthly income
const EMI_LOAD_LOW  = 0.3;   // EMI < 30% of monthly income
const COLLATERAL_ADEQUATE = 0.8; // collateral covers ≥ 80% of requested
const UPI_ACTIVE = 10;       // ≥ 10 UPI txns is a positive signal
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} card - Partial applicant card (pre-summary)
 * @returns {{ topPositiveFactors: string[], topNegativeFactors: string[] }}
 */
export function deriveFactors(card) {
  const positive = [];
  const negative = [];

  const pd         = card.probabilityOfDefault;
  const credit     = card.creditScore;
  const risk       = card.riskLevel;
  const requested  = card.requestedAmount  || 0;
  const eligible   = card.eligibleAmount   || 0;
  const collateral = card.collateralValue  || 0;
  const monthly    = card.monthlyIncome    || card.householdMonthlyIncome || 0;
  const emiLoad    = card.totalExistingEmiBurden || 0;
  const upiCount   = card.upiTransactionCount   || 0;

  // ── Probability of Default ─────────────────────────────────────────────────
  if (typeof pd === "number") {
    const pct = (pd * 100).toFixed(1);
    if (pd <= PD_LOW) {
      positive.push(
        `Low probability of default (${pct}%) — strong repayment likelihood`
      );
    } else if (pd >= PD_HIGH) {
      negative.push(
        `High probability of default (${pct}%) — significant repayment concern`
      );
    } else {
      negative.push(
        `Moderate probability of default (${pct}%) — borderline repayment risk`
      );
    }
  }

  // ── Credit Score ───────────────────────────────────────────────────────────
  if (typeof credit === "number" && credit > 0) {
    if (credit >= CREDIT_GOOD) {
      positive.push(
        `Credit score ${credit} — above preferred threshold (${CREDIT_GOOD})`
      );
    } else if (credit < CREDIT_POOR) {
      negative.push(
        `Credit score ${credit} — below minimum preferred threshold (${CREDIT_POOR})`
      );
    }
  }

  // ── Model Risk Level ───────────────────────────────────────────────────────
  if (risk === "low") {
    positive.push("Model-assigned low risk — eligible for fast-track consideration");
  } else if (risk === "high") {
    negative.push("Model-assigned high risk — requires enhanced due diligence");
  }

  // ── AML / Pre-screen ──────────────────────────────────────────────────────
  if (Array.isArray(card.amlFlags) && card.amlFlags.length > 0) {
    const meaningfulFlags = card.amlFlags.filter(
      (flag) =>
        !String(flag).startsWith("ml_inference_failed") &&
        !String(flag).startsWith("ml_dependency_missing") &&
        !String(flag).startsWith("ml_timeout") &&
        !String(flag).startsWith("ml_invalid_output")
    );
    if (meaningfulFlags.length > 0) {
      negative.push(`AML/pre-screen flags triggered: ${meaningfulFlags.join(", ")}`);
    } else {
      negative.push("Model fallback used — review recommended before final decision");
    }
  }
  if (card.preScreenStatus === "reject") {
    negative.push("Failed automated pre-screen — hard-reject flag(s) detected");
  } else if (card.preScreenStatus === "pass") {
    positive.push("Passed automated pre-screen — no hard-reject flags present");
  }

  // ── Banking Footprint ─────────────────────────────────────────────────────
  if (card.hasBankAccount === true) {
    positive.push("Active bank account confirmed — formal financial access established");
  } else if (card.hasBankAccount === false) {
    negative.push("No bank account on record — limited formal financial access");
  }

  if (card.hasUpiHistory === true) {
    positive.push("Active UPI history — demonstrated digital payment behaviour");
  } else if (card.hasUpiHistory === false) {
    negative.push("No UPI transaction history — thin digital payment footprint");
  }

  if (upiCount >= UPI_ACTIVE) {
    positive.push(
      `High UPI activity (${upiCount} transactions) — consistent digital transaction pattern`
    );
  }

  // ── Salary & Income Source ────────────────────────────────────────────────
  if (card.salaryCreditedToBank === true) {
    positive.push("Salary directly credited to bank — formally verifiable income source");
  }

  // ── EMI Burden ────────────────────────────────────────────────────────────
  if (monthly > 0 && emiLoad > 0) {
    const ratio = emiLoad / monthly;
    if (ratio >= EMI_LOAD_HIGH) {
      negative.push(
        `High existing EMI burden (${(ratio * 100).toFixed(0)}% of monthly income) — debt service capacity constrained`
      );
    } else if (ratio < EMI_LOAD_LOW) {
      positive.push(
        `Low existing EMI burden (${(ratio * 100).toFixed(0)}% of monthly income) — adequate debt service headroom`
      );
    }
  }

  // ── Collateral ────────────────────────────────────────────────────────────
  if (requested > 0) {
    if (collateral > 0) {
      const cov = collateral / requested;
      if (cov >= COLLATERAL_ADEQUATE) {
        positive.push(
          `Collateral covers ${(cov * 100).toFixed(0)}% of requested amount — adequate security provided`
        );
      } else {
        negative.push(
          `Collateral covers only ${(cov * 100).toFixed(0)}% of requested amount — partial coverage`
        );
      }
    } else {
      negative.push("No collateral provided — fully unsecured application increases risk exposure");
    }
  }

  // ── Eligible vs Requested Amount ─────────────────────────────────────────
  if (requested > 0 && eligible > 0) {
    if (eligible < requested * 0.8) {
      negative.push(
        `Eligible amount (₹${eligible.toLocaleString()}) is significantly below requested ` +
        `(₹${requested.toLocaleString()}) — income or risk constraints apply`
      );
    } else if (eligible >= requested) {
      positive.push(
        "Eligible amount meets or exceeds requested amount — within the system's serviceable range"
      );
    }
  }

  // ── Document Verification ─────────────────────────────────────────────────
  if (card.docsVerified === true) {
    positive.push("Documentation verified — supporting documents on file");
  } else if (card.docsVerified === false) {
    negative.push("Documentation not verified — income or identity claims unconfirmed");
  }

  if (card.identityVerified === true) {
    positive.push("Identity document verified (OCR) — strong KYC signal");
  }

  // ── Business Formalization (business loans only) ──────────────────────────
  if (card.loanType === "business") {
    if (card.hasGst === true) {
      positive.push("GST registered — recognised formal business entity");
    } else if (card.hasGst === false) {
      negative.push("Not GST registered — informal or unregistered business operation");
    }

    if (card.hasUdyam === true) {
      positive.push("UDYAM registered — MSME formalization confirmed");
    }

    if (typeof card.businessAgeMonths === "number") {
      if (card.businessAgeMonths >= 24) {
        positive.push(
          `Business operational for ${Math.floor(card.businessAgeMonths / 12)} year(s) — established trading history`
        );
      } else if (card.businessAgeMonths < 12) {
        negative.push(
          `Business operational for only ${card.businessAgeMonths} months — limited operating history`
        );
      }
    }
  }

  return {
    topPositiveFactors: positive.slice(0, 5),
    topNegativeFactors: negative.slice(0, 5),
  };
}
