/**
 * Headline unbanked score ↔ PD ↔ risk band must stay consistent in UI and APIs.
 * blendedScore = round(300 + (1 - blendedPd) * 550) in the pipeline; we snap PD
 * to the exact inverse of the rounded integer score for persistence/display.
 */

function clamp(x, a, b) {
  return Math.min(b, Math.max(a, x));
}

export function probabilityOfDefaultFromBlendedScore(blendedScore) {
  return clamp(1 - (Number(blendedScore) - 300) / 550, 0.05, 0.95);
}

export function riskLevelFromBlendedScore(blendedScore) {
  const s = Number(blendedScore);
  if (!Number.isFinite(s)) return "medium";
  if (s >= 700) return "low";
  if (s >= 590) return "medium";
  return "high";
}
