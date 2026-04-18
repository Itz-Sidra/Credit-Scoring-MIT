/**
 * geminiService.js — Gemini-powered loan explainability
 *
 * Generates 3-5 plain-English bullet explanations for a loan decision
 * using applicant signals: probability, social_score, income, loan amount.
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - API key lives ONLY in backend env (GEMINI_API_KEY) — never exposed to frontend
 *  - Falls back gracefully if Gemini is unavailable
 *  - No existing file modified
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Build a tightly scoped prompt so Gemini stays grounded in the numbers.
 */
function buildPrompt({ probability, socialScore, monthlyIncome, loanAmount, riskLevel, loanType }) {
  const defaultPct   = ((1 - (probability ?? 0.5)) * 100).toFixed(1);
  const repayPct     = ((probability ?? 0.5) * 100).toFixed(1);
  const incomeStr    = monthlyIncome ? `₹${Number(monthlyIncome).toLocaleString("en-IN")}/mo` : "not disclosed";
  const amountStr    = loanAmount    ? `₹${Number(loanAmount).toLocaleString("en-IN")}` : "unspecified";
  const socialStr    = socialScore   != null ? `${socialScore}/100` : "not available";
  const riskStr      = (riskLevel || "medium").toUpperCase();

  return `You are a senior credit analyst at a bank. Explain the following loan decision signals in 4 concise bullet points.

APPLICANT DATA:
- Loan type: ${loanType || "personal"}
- Requested amount: ${amountStr}
- Monthly income: ${incomeStr}
- Repayment probability (ML model): ${repayPct}%
- Default probability: ${defaultPct}%
- Social trust score: ${socialStr}
- Overall risk band: ${riskStr}

INSTRUCTIONS:
- Write exactly 4 bullet points
- Each bullet: 1 sentence, under 20 words
- Focus only on the data provided — do NOT invent facts
- Tone: professional, factual, no fluff
- Format: return ONLY a JSON array of 4 strings, nothing else
- Example format: ["Bullet one.", "Bullet two.", "Bullet three.", "Bullet four."]`;
}

/**
 * Call Gemini Flash to generate explanation bullets.
 *
 * @param {object} signals
 * @param {number}  signals.probability      - repayment probability (0–1)
 * @param {number}  signals.socialScore      - social trust score (0–100)
 * @param {number}  [signals.monthlyIncome]  - monthly income in ₹
 * @param {number}  [signals.loanAmount]     - requested loan amount in ₹
 * @param {string}  [signals.riskLevel]      - "low" | "medium" | "high"
 * @param {string}  [signals.loanType]       - loan type string
 *
 * @returns {Promise<string[]>} Array of 3–5 explanation bullets
 */
export async function generateLoanExplanation(signals) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("[geminiService] GEMINI_API_KEY not set — using rule-based fallback");
    return generateFallbackExplanation(signals);
  }

  const prompt = buildPrompt(signals);

  let response;
  try {
    response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.2,
          maxOutputTokens: 300,
          topP:            0.8,
        },
      }),
    });
  } catch (fetchErr) {
    console.error("[geminiService] Network error:", fetchErr.message);
    return generateFallbackExplanation(signals);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[geminiService] Gemini API ${response.status}: ${body.slice(0, 200)}`);
    return generateFallbackExplanation(signals);
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    console.error("[geminiService] JSON parse error:", parseErr.message);
    return generateFallbackExplanation(signals);
  }

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!raw) {
    console.warn("[geminiService] Empty response from Gemini");
    return generateFallbackExplanation(signals);
  }

  // Parse the JSON array Gemini returns
  try {
    // Strip markdown code fences if present
    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const bullets = JSON.parse(clean);
    if (Array.isArray(bullets) && bullets.length >= 2) {
      return bullets.slice(0, 5).map(String);
    }
  } catch {
    // Fallback: split by newlines and strip bullet chars
    const lines = raw
      .split("\n")
      .map((l) => l.replace(/^[\-\*\d\.]\s*/, "").trim())
      .filter((l) => l.length > 10);
    if (lines.length >= 2) return lines.slice(0, 5);
  }

  console.warn("[geminiService] Could not parse Gemini output — using fallback");
  return generateFallbackExplanation(signals);
}

/**
 * Rule-based fallback when Gemini is unavailable.
 * Always returns 4 meaningful bullets derived purely from the numbers.
 */
function generateFallbackExplanation({ probability, socialScore, monthlyIncome, loanAmount, riskLevel }) {
  const bullets = [];
  const repayPct   = ((probability ?? 0.5) * 100).toFixed(1);
  const defaultPct = ((1 - (probability ?? 0.5)) * 100).toFixed(1);
  const risk       = (riskLevel || "medium").toLowerCase();

  // Bullet 1: repayment probability
  if ((probability ?? 0.5) >= 0.7) {
    bullets.push(`ML model assigns ${repayPct}% repayment probability, indicating strong creditworthiness.`);
  } else if ((probability ?? 0.5) >= 0.5) {
    bullets.push(`Repayment probability of ${repayPct}% suggests moderate credit risk requiring review.`);
  } else {
    bullets.push(`Low repayment probability (${repayPct}%) and ${defaultPct}% default risk flag this case for caution.`);
  }

  // Bullet 2: social trust
  if (socialScore != null) {
    if (socialScore >= 70) {
      bullets.push(`Social trust score of ${socialScore}/100 positively contributes to the blended credit assessment.`);
    } else if (socialScore >= 40) {
      bullets.push(`Moderate social trust score (${socialScore}/100) has a neutral effect on the final decision.`);
    } else {
      bullets.push(`Low social trust score (${socialScore}/100) indicates limited digital financial presence.`);
    }
  } else {
    bullets.push("Social trust signals were not provided; decision relies entirely on ML model output.");
  }

  // Bullet 3: income vs loan amount
  if (monthlyIncome && loanAmount) {
    const monthlyRatio = loanAmount / (monthlyIncome * 12);
    if (monthlyRatio <= 3) {
      bullets.push(`Loan-to-annual-income ratio of ${monthlyRatio.toFixed(1)}x is within acceptable thresholds.`);
    } else if (monthlyRatio <= 6) {
      bullets.push(`Loan amount is ${monthlyRatio.toFixed(1)}x annual income, approaching upper affordability limits.`);
    } else {
      bullets.push(`Loan-to-income ratio of ${monthlyRatio.toFixed(1)}x exceeds standard affordability guidelines.`);
    }
  } else if (loanAmount) {
    bullets.push(`Requested amount of ₹${Number(loanAmount).toLocaleString("en-IN")} could not be assessed against income.`);
  } else {
    bullets.push("Income and loan amount data were insufficient for detailed affordability analysis.");
  }

  // Bullet 4: risk band summary
  const riskMap = {
    low:    "Low risk band supports expedited approval consideration.",
    medium: "Medium risk band warrants manual review before final approval.",
    high:   "High risk band indicates significant repayment concerns; enhanced due diligence required.",
  };
  bullets.push(riskMap[risk] || "Risk classification requires further analysis.");

  return bullets;
}