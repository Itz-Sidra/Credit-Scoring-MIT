/**
 * Social Data Service
 *
 * Simulates social media signals for credit enrichment.
 * No external APIs — all values are derived from optional user-supplied
 * hints OR generated as realistic mocks when hints are absent.
 *
 * CONTRACT:
 *  getSocialFeatures(hints?)  →  SocialFeatures
 *  computeSocialScore(features)  →  number (0–100)
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Pure computation — no DB, no HTTP, no side effects.
 *  - Never modifies the ML model pipeline.
 *  - Adding this file does NOT touch any existing service.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Seeded deterministic "random" so the same user always gets the same mock
 * value within a session (avoids score flickering on re-render).
 * Uses a simple LCG — good enough for display purposes.
 */
function seededRandom(seed) {
  const s = Math.abs(seed % 2147483647) || 1;
  return ((s * 16807) % 2147483647) / 2147483647;
}

function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Feature derivation ────────────────────────────────────────────────────────

const FREQUENCY_MAP = {
  low:    { postsPerMonth: 2,  engagementBase: 0.25 },
  medium: { postsPerMonth: 10, engagementBase: 0.55 },
  high:   { postsPerMonth: 28, engagementBase: 0.78 },
};

/**
 * Derive social features from optional user hints.
 * When a hint is absent, a plausible mock is generated.
 *
 * @param {object} [hints]
 * @param {boolean} [hints.isActive]            - user said they are active on social media
 * @param {number}  [hints.accountAge]          - account age in years (user-supplied)
 * @param {"low"|"medium"|"high"} [hints.postingFrequency] - user-selected frequency
 * @param {string}  [hints.seed]                - optional deterministic seed (e.g. userId)
 *
 * @returns {{
 *   account_age_days: number,
 *   avg_posts_per_month: number,
 *   sentiment_score: number,
 *   engagement_score: number,
 *   profile_completeness: number
 * }}
 */
export function getSocialFeatures(hints = {}) {
  const {
    isActive = true,
    accountAge = null,
    postingFrequency = null,
    seed = "default",
  } = hints;

  // 🚨 Handle NO social presence explicitly
if (isActive === false) {
  return {
    account_age_days: 0,
    avg_posts_per_month: 0,
    sentiment_score: 0.4, // neutral
    engagement_score: 0,
    profile_completeness: 0,
  };
}

  const r = seededRandom(seedFromString(String(seed)));
  const r2 = seededRandom(seedFromString(String(seed) + "2"));
  const r3 = seededRandom(seedFromString(String(seed) + "3"));

  // ── account_age_days ────────────────────────────────────────────────────────
  let account_age_days;
  if (accountAge != null && Number.isFinite(Number(accountAge))) {
    account_age_days = Math.round(Number(accountAge) * 365);
  } else {
    // Mock: 6 months – 8 years
    account_age_days = Math.round(180 + r * (2920 - 180));
  }
  account_age_days = clamp(account_age_days, 0, 10000);

  // ── avg_posts_per_month ─────────────────────────────────────────────────────
  let avg_posts_per_month;
  if (postingFrequency && FREQUENCY_MAP[postingFrequency]) {
    const base = FREQUENCY_MAP[postingFrequency].postsPerMonth;
    avg_posts_per_month = clamp(base + (r2 - 0.5) * base * 0.4, 0, 60);
  } else {
    avg_posts_per_month = isActive ? clamp(r * 25, 1, 60) : clamp(r * 4, 0, 4);
  }
  avg_posts_per_month = Math.round(avg_posts_per_month * 10) / 10;

  // ── engagement_score ────────────────────────────────────────────────────────
  let engagement_score;
  if (postingFrequency && FREQUENCY_MAP[postingFrequency]) {
    const base = FREQUENCY_MAP[postingFrequency].engagementBase;
    engagement_score = clamp(base + (r3 - 0.5) * 0.2, 0, 1);
  } else {
    engagement_score = isActive ? clamp(0.4 + r * 0.5, 0, 1) : clamp(r * 0.3, 0, 1);
  }
  engagement_score = Math.round(engagement_score * 1000) / 1000;

  // ── sentiment_score ─────────────────────────────────────────────────────────
  // Active users skew positive; inactive users are neutral
  const sentimentBase = isActive ? 0.58 : 0.48;
  const sentiment_score = clamp(
    sentimentBase + (seededRandom(seedFromString(seed + "sent")) - 0.45) * 0.3,
    0,
    1
  );

  // ── profile_completeness ────────────────────────────────────────────────────
  // If user says active AND account is reasonably old → likely complete
  const profile_completeness =
    isActive && account_age_days > 180 ? 1 : isActive ? 0 : 0;

  return {
    account_age_days,
    avg_posts_per_month,
    sentiment_score: Math.round(sentiment_score * 1000) / 1000,
    engagement_score,
    profile_completeness,
  };
}

// ── Score computation ─────────────────────────────────────────────────────────

/**
 * Compute a 0–100 social trust score from social features.
 *
 * Weights (tuned to mirror credit-adjacent behavioural signals):
 *   account_age       30%  — longevity signals stability
 *   engagement        25%  — consistency of digital activity
 *   sentiment         25%  — positive online behaviour
 *   posts_per_month   10%  — activity level (penalises extremes)
 *   profile_complete  10%  — identity completeness
 *
 * @param {object} features - output of getSocialFeatures()
 * @returns {number} social_score in [0, 100]
 */
export function computeSocialScore(features) {
  const {
    account_age_days = 0,
    avg_posts_per_month = 0,
    sentiment_score = 0.5,
    engagement_score = 0,
    profile_completeness = 0,
  } = features;

  // Normalise account age: 0 days → 0, 5 years (1825 days) → 1
  const age_norm = clamp(account_age_days / 1825, 0, 1);

  // Posts: penalise both inactivity (<2) and over-posting (>30)
  const post_norm = avg_posts_per_month < 2
    ? avg_posts_per_month / 2
    : avg_posts_per_month > 30
      ? Math.max(0, 1 - (avg_posts_per_month - 30) / 30)
      : clamp(avg_posts_per_month / 15, 0, 1);

 const raw =
  age_norm         * 0.35 +   // ↑ more weight
  engagement_score * 0.30 +   // ↑ more weight
  sentiment_score  * 0.20 +   // ↓ slightly
  post_norm        * 0.10 +
  profile_completeness * 0.05;

  return Math.round(clamp(raw, 0, 1) * 100);
}

// ── Human-readable insights ───────────────────────────────────────────────────

/**
 * Generate up to 3 short insight strings based on social features.
 * Always returns exactly 3 entries.
 *
 * @param {object} features
 * @param {number} socialScore  - 0–100
 * @returns {string[]}
 */
export function getSocialInsights(features, socialScore) {
  const {
    account_age_days,
    avg_posts_per_month,
    sentiment_score,
    engagement_score,
    profile_completeness,
  } = features;

  const insights = [];

  // Sentiment
  if (sentiment_score >= 0.65) {
    insights.push("Positive online sentiment detected across activity signals.");
  } else if (sentiment_score >= 0.45) {
    insights.push("Neutral sentiment profile — no negative flags found.");
  } else {
    insights.push("Sentiment signals are mixed; no major risk indicators.");
  }

  // Account age
  const ageYears = (account_age_days / 365).toFixed(1);
  if (account_age_days >= 730) {
    insights.push(`Established account with ${ageYears} years of digital history.`);
  } else if (account_age_days >= 180) {
    insights.push(`Active account with ${ageYears} years of presence — growing history.`);
  } else {
    insights.push("Newer account; limited digital history available.");
  }

  // Engagement
  if (engagement_score >= 0.65) {
    insights.push("High engagement rate indicates stable and consistent activity.");
  } else if (engagement_score >= 0.35) {
    insights.push("Moderate engagement — regular but not hyperactive digital presence.");
  } else {
    insights.push("Low engagement detected; occasional digital activity only.");
  }

  // Ensure exactly 3
  return insights.slice(0, 3);
}