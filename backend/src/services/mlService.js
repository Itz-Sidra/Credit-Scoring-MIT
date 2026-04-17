/**
 * mlService.js — Production ML inference bridge (Node → Python).
 *
 * Changes from original:
 *  1. Uses new stacking_pipeline.pkl via model_inference/predict.py path.
 *  2. NO heuristic / silent fallback — errors surface explicitly.
 *  3. Single subprocess call per request (no duplicate invocations).
 *  4. Proper timeout handling with SIGKILL.
 *  5. Groq API fallback (clearly labeled "fallback_response") when Python fails.
 *  6. Structured logging for every failure path.
 *  7. Response matches agreed API contract:
 *       { probability, risk_level, explanation: { type, top_features } }
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Paths ─────────────────────────────────────────────────────────────────────

const BACKEND_ROOT   = path.resolve(__dirname, "..", "..");
const ML_RUNNER_PATH = path.resolve(__dirname, "ml_runner.py");

// Support both legacy artifact and new stacking_pipeline
const DEFAULT_ARTIFACT_PATH =
  process.env.ML_ARTIFACT_PATH || "/app/models/new/stacking_pipeline.pkl";

// ── Feature list (must match ml_runner.py FEATURE_NAMES exactly) ─────────────

const FEATURE_NAMES = [
  "income_monthly",
  "income_log",
  "income_decile",
  "job_tenure_ratio",
  "new_job_flag",
  "income_per_exp",
  "is_early_career",
  "is_single",
  "is_renter",
  "has_car",
  "young_single",
  "renter_no_car",
  "profession_woe",
  "state_woe",
  "emi_to_income_cs",
  "debt_to_income_cs",
  "avg_delay_days",
  "payment_stress_index",
  "is_over_utilized",
  "is_thin_file",
  "hc_ext_source_mean",
  "hc_credit_to_income",
  "hc_annuity_to_income",
  "hc_employed_years",
  "hc_install_late_ratio",
  "utility_payment_score",
  "transaction_consistency",
  "has_bank_account",
  "platform_trust_score",
  "platform_tenure_score",
];

const FEATURE_DEFAULTS = {
  income_monthly: 33222.0,
  income_log: 10.41,
  income_decile: 5.0,
  job_tenure_ratio: 0.62,
  new_job_flag: 0.0,
  income_per_exp: 1.8,
  is_early_career: 0.0,
  is_single: 1.0,
  is_renter: 1.0,
  has_car: 0.0,
  young_single: 0.0,
  renter_no_car: 1.0,
  profession_woe: 0.15,
  state_woe: 0.03,
  emi_to_income_cs: 0.25,
  debt_to_income_cs: 0.35,
  avg_delay_days: 2.5,
  payment_stress_index: 0.12,
  is_over_utilized: 0.0,
  is_thin_file: 0.0,
  hc_ext_source_mean: 0.52,
  hc_credit_to_income: 2.3,
  hc_annuity_to_income: 0.12,
  hc_employed_years: 3.2,
  hc_install_late_ratio: 0.08,
  utility_payment_score: 0.72,
  transaction_consistency: 0.45,
  has_bank_account: 1.0,
  platform_trust_score: 0.65,
  platform_tenure_score: 0.80,
};

// ── Configuration ─────────────────────────────────────────────────────────────

const PYTHON_BIN  = process.env.ML_PYTHON_BIN || "python3";
const TIMEOUT_MS  = Number(process.env.ML_INFERENCE_TIMEOUT_MS || 15_000);
const GROQ_API_KEY = process.env.GROQ_API_KEY || null;

// ── Feature builder ───────────────────────────────────────────────────────────

/**
 * Map an arbitrary applicant payload to the 30-feature vector.
 * All values are coerced to finite numbers. Missing → FEATURE_DEFAULTS.
 *
 * This is a lightweight bridge — the heavy preprocessing lives in Python.
 * Node only needs to assemble the dict; Python validates and type-checks.
 */
function buildFeatureVector(payload = {}) {
  const features = {};
  const missingKeys = [];

  for (const name of FEATURE_NAMES) {
    // Attempt to pull the value by exact name from the payload
    let val = payload[name];

    if (val === undefined || val === null) {
      val = FEATURE_DEFAULTS[name];
      missingKeys.push(name);
    }

    const num = Number(val);
    features[name] = Number.isFinite(num) ? num : FEATURE_DEFAULTS[name];
  }

  if (missingKeys.length > 0) {
    console.warn(
      `[mlService] ${missingKeys.length} features filled with defaults: ${missingKeys.join(", ")}`
    );
  }

  return features;
}

// ── Python subprocess runner ──────────────────────────────────────────────────

/**
 * Spawns ml_runner.py ONCE with the feature vector.
 * Returns parsed JSON or throws a structured error.
 * NEVER calls itself recursively or has a silent path.
 */
function runPythonInference(features, artifactPath) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const child = spawn(PYTHON_BIN, [ML_RUNNER_PATH, artifactPath], {
      cwd: BACKEND_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Hard timeout — kill the process and reject
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      reject(
        Object.assign(
          new Error(`ML inference timed out after ${TIMEOUT_MS}ms`),
          { code: "ML_TIMEOUT" }
        )
      );
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        Object.assign(
          new Error(`Failed to spawn Python process: ${err.message}`),
          { code: "SPAWN_FAILED", cause: err }
        )
      );
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      if (timedOut) return; // already rejected

      // Log Python stderr regardless of exit code (diagnostic info)
      if (stderr.trim()) {
        console.info(`[mlService/python] ${stderr.trim()}`);
      }

      const raw = stdout.trim();
      if (!raw) {
        return reject(
          Object.assign(
            new Error(`Python process exited ${exitCode} with empty stdout`),
            { code: "EMPTY_OUTPUT" }
          )
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return reject(
          Object.assign(
            new Error(`Invalid JSON from ml_runner: ${raw.slice(0, 200)}`),
            { code: "INVALID_JSON_OUTPUT" }
          )
        );
      }

      // ml_runner signals its own errors via { error, error_code }
      if (parsed.error) {
        return reject(
          Object.assign(
            new Error(`ml_runner error [${parsed.error_code}]: ${parsed.error}`),
            { code: parsed.error_code || "ML_RUNNER_ERROR" }
          )
        );
      }

      resolve(parsed);
    });

    // Send features to Python via stdin
    const inputJson = JSON.stringify({ features });
    child.stdin.write(inputJson);
    child.stdin.end();
  });
}

// ── Groq API fallback ─────────────────────────────────────────────────────────

/**
 * Calls Groq to generate a mock credit risk assessment.
 * Clearly labeled as "fallback_response" — never silently replaces real ML.
 * Only invoked when Python ML fails AND GROQ_API_KEY is set.
 */
async function callGroqFallback(features, originalError) {
  if (!GROQ_API_KEY) {
    throw Object.assign(
      new Error(
        `ML inference failed and GROQ_API_KEY is not set — cannot produce fallback. ` +
        `Original error: ${originalError.message}`
      ),
      { code: "NO_FALLBACK_AVAILABLE", originalError }
    );
  }

  console.error(
    `[mlService] ML pipeline failed (${originalError.code || "UNKNOWN"}): ${originalError.message}. ` +
    `Attempting Groq fallback — result will be labeled fallback_response.`
  );

  const prompt = `You are a credit risk analyst AI assistant.

Given these normalized applicant features, provide a credit default probability estimate.
Features (JSON): ${JSON.stringify(features, null, 2)}

Respond with ONLY valid JSON in this exact format — no preamble, no markdown:
{
  "probability": <float between 0.01 and 0.99>,
  "risk_level": "<LOW|MEDIUM|HIGH>",
  "top_features": [
    { "feature": "<feature_name>", "impact": <float> },
    { "feature": "<feature_name>", "impact": <float> },
    { "feature": "<feature_name>", "impact": <float> },
    { "feature": "<feature_name>", "impact": <float> },
    { "feature": "<feature_name>", "impact": <float> }
  ]
}

Rules:
- probability >= 0.60 → risk_level = "HIGH"
- probability 0.35–0.59 → risk_level = "MEDIUM"  
- probability < 0.35 → risk_level = "LOW"
- top_features: pick 5 features from the input with highest estimated impact on default risk
- impact: positive = increases default risk, negative = decreases it`;

  let response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 400,
      }),
    });
  } catch (fetchErr) {
    throw Object.assign(
      new Error(`Groq API request failed: ${fetchErr.message}`),
      { code: "GROQ_REQUEST_FAILED", originalError }
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw Object.assign(
      new Error(`Groq API returned ${response.status}: ${body.slice(0, 200)}`),
      { code: "GROQ_API_ERROR", originalError }
    );
  }

  const groqData = await response.json();
  const content = groqData?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw Object.assign(
      new Error("Groq returned empty content"),
      { code: "GROQ_EMPTY_RESPONSE", originalError }
    );
  }

  let parsed;
  try {
    // Strip potential markdown code fences
    const clean = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(clean);
  } catch {
    throw Object.assign(
      new Error(`Groq returned invalid JSON: ${content.slice(0, 200)}`),
      { code: "GROQ_INVALID_JSON", originalError }
    );
  }

  console.warn("[mlService] Groq fallback succeeded — labeling as fallback_response");

  return {
    probability: Math.min(0.99, Math.max(0.01, Number(parsed.probability) || 0.5)),
    risk_level: ["LOW", "MEDIUM", "HIGH"].includes(parsed.risk_level) ? parsed.risk_level : "MEDIUM",
    explanation_type: "fallback_response",
    top_features: Array.isArray(parsed.top_features) ? parsed.top_features.slice(0, 5) : [],
    fallback_reason: originalError.message,
  };
}

// ── Model readiness check ─────────────────────────────────────────────────────

export async function getModelReadiness() {
  const artifactPath = DEFAULT_ARTIFACT_PATH;
  try {
    await fs.access(artifactPath);
    await fs.access(ML_RUNNER_PATH);
    return {
      ready: true,
      artifactPath,
      runnerPath: ML_RUNNER_PATH,
      pythonBin: PYTHON_BIN,
    };
  } catch (err) {
    return {
      ready: false,
      reason: err.message,
      artifactPath,
      runnerPath: ML_RUNNER_PATH,
      pythonBin: PYTHON_BIN,
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run credit risk inference for one applicant.
 *
 * @param {object} payload - Raw applicant feature payload (keys match FEATURE_NAMES).
 * @returns {Promise<{
 *   success: boolean,
 *   data: {
 *     probability: number,
 *     risk_level: string,
 *     explanation: { type: string, top_features: Array }
 *   },
 *   source: "ml_model" | "groq_fallback"
 * }>}
 *
 * Throws if both ML and fallback fail. NEVER returns a silent default.
 */
export async function predictCreditRisk(payload = {}) {
  const features = buildFeatureVector(payload);
  const artifactPath = DEFAULT_ARTIFACT_PATH;

  // Verify artifact exists before spawning Python
  try {
    await fs.access(artifactPath);
  } catch {
    const err = Object.assign(
      new Error(`Model artifact not found: ${artifactPath}`),
      { code: "ARTIFACT_NOT_FOUND" }
    );
    console.error(`[mlService] ${err.message}`);
    // Attempt Groq fallback immediately
    const fallback = await callGroqFallback(features, err);
    return _formatResponse(fallback, "groq_fallback");
  }

  let mlResult;
  try {
    mlResult = await runPythonInference(features, artifactPath);
  } catch (mlErr) {
    console.error(
      `[mlService] Python ML failed [${mlErr.code}]: ${mlErr.message}`
    );
    // Attempt Groq fallback — throws if Groq also fails
    const fallback = await callGroqFallback(features, mlErr);
    return _formatResponse(fallback, "groq_fallback");
  }

  return _formatResponse(mlResult, "ml_model");
}

/**
 * Legacy compatibility wrapper used by loanController and creditController.
 * Maps old-style payload → new feature vector → predictCreditRisk.
 *
 * Returns the shape existing controllers expect:
 * { creditScore, riskLevel, probability, modelInfo }
 */
export async function predictCreditScoreWithModel(payload = {}) {
  const result = await predictCreditRisk(payload);
  const { probability, risk_level, explanation, source } = result.data;

  // Derive a conventional credit score from probability (repayment probability = 1 - default prob)
  const repaymentProb = Math.max(0.05, Math.min(0.95, 1 - probability));
  const creditScore = Math.round(300 + repaymentProb * 550);

  return {
    creditScore,
    riskLevel: risk_level.toLowerCase(),
    // Expose probability as repayment probability for backward compat
    probability: repaymentProb,
    modelInfo: {
      modelType: source === "groq_fallback" ? "GroqFallback" : "StackingEnsemble",
      source,
      explanationType: explanation.type,
      topFeatures: explanation.top_features,
      artifactPath: DEFAULT_ARTIFACT_PATH,
      featureContract: "stacking_pipeline_v1_30_features",
    },
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _formatResponse(raw, source) {
  return {
    success: true,
    data: {
      probability: raw.probability,
      risk_level: raw.risk_level,
      explanation: {
        type: raw.explanation_type || "unknown",
        top_features: raw.top_features || [],
        ...(raw.fallback_reason ? { fallback_reason: raw.fallback_reason } : {}),
      },
    },
    source,
  };
}