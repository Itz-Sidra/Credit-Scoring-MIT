/**
 * Demo vault: verified alternate summaries keyed by normalized reference ID (e.g. PAN).
 * Admin attaches via "Load vault" — not user uploads.
 */

function tierRank(tier) {
  if (tier === "strong") return 2;
  if (tier === "medium") return 1;
  if (tier === "none") return 0;
  return 0;
}

const VAULT = new Map([
  [
    "AAAAA1111A",
    {
      persona: "strong_both",
      qualityTier: "strong",
      notes: "Long UPI + utility; regular payments",
      upiSummary: {
        monthlyInflow: 72000,
        monthlyOutflow: 38000,
        avgMonthlyTransactionCount: 42,
        transactionRegularity: 0.78,
        monthsHistory: 10,
      },
      utilitySummary: {
        utilityPaymentRegularity: 0.94,
        monthsHistory: 9,
      },
    },
  ],
  [
    "BBBBB2222B",
    {
      persona: "weak_both",
      qualityTier: "weak",
      notes: "Both files but short window / lower regularity",
      upiSummary: {
        monthlyInflow: 28000,
        monthlyOutflow: 24000,
        avgMonthlyTransactionCount: 12,
        transactionRegularity: 0.48,
        monthsHistory: 3,
      },
      utilitySummary: {
        utilityPaymentRegularity: 0.62,
        monthsHistory: 3,
      },
    },
  ],
  [
    "CCCCC3333C",
    {
      persona: "upi_only",
      qualityTier: "medium",
      notes: "UPI only — no utility on file",
      upiSummary: {
        monthlyInflow: 55000,
        monthlyOutflow: 32000,
        avgMonthlyTransactionCount: 35,
        transactionRegularity: 0.68,
        monthsHistory: 8,
      },
      utilitySummary: null,
    },
  ],
  [
    "DDDDD4444D",
    {
      persona: "utility_only",
      qualityTier: "medium",
      notes: "Utility only — no UPI on file",
      upiSummary: null,
      utilitySummary: {
        utilityPaymentRegularity: 0.88,
        monthsHistory: 12,
      },
    },
  ],
  [
    "EEEEE5555E",
    {
      persona: "none",
      qualityTier: "none",
      notes: "Reference only — admin has no extracts yet",
      upiSummary: null,
      utilitySummary: null,
    },
  ],
]);

export function normalizeReferenceId(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function lookupAlternateVault(referenceId) {
  const key = normalizeReferenceId(referenceId);
  if (!key) return null;
  return VAULT.get(key) || null;
}

export function listAlternateVaultKeys() {
  return [...VAULT.keys()];
}

export { tierRank };
