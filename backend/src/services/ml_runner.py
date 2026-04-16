#!/usr/bin/env python3
"""
ml_runner.py — Production ML inference runner.

Accepts JSON from stdin: { "features": { ... } }
Returns JSON to stdout:  { "probability": float, "risk_level": str, "top_features": [...], "explanation_type": str }

Error contract:
  - On any failure: { "error": str, "error_code": str }
  - NEVER silently returns a default — caller must handle error.
"""

import json
import sys
import os
import logging
import traceback
from pathlib import Path

import numpy as np
import pandas as pd

# ── Logging (stderr so stdout stays clean JSON) ───────────────────────────────
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="[ml_runner] %(levelname)s %(message)s",
)
log = logging.getLogger("ml_runner")

# ── Canonical feature list — MUST match training order exactly ────────────────
FEATURE_NAMES = [
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
]

FEATURE_DEFAULTS = {
    "income_monthly": 33222.0,
    "income_log": 10.41,
    "income_decile": 5.0,
    "job_tenure_ratio": 0.62,
    "new_job_flag": 0.0,
    "income_per_exp": 1.8,
    "is_early_career": 0.0,
    "is_single": 1.0,
    "is_renter": 1.0,
    "has_car": 0.0,
    "young_single": 0.0,
    "renter_no_car": 1.0,
    "profession_woe": 0.15,
    "state_woe": 0.03,
    "emi_to_income_cs": 0.25,
    "debt_to_income_cs": 0.35,
    "avg_delay_days": 2.5,
    "payment_stress_index": 0.12,
    "is_over_utilized": 0.0,
    "is_thin_file": 0.0,
    "hc_ext_source_mean": 0.52,
    "hc_credit_to_income": 2.3,
    "hc_annuity_to_income": 0.12,
    "hc_employed_years": 3.2,
    "hc_install_late_ratio": 0.08,
    "utility_payment_score": 0.72,
    "transaction_consistency": 0.45,
    "has_bank_account": 1.0,
    "platform_trust_score": 0.65,
    "platform_tenure_score": 0.80,
}


# ── Model loading ─────────────────────────────────────────────────────────────

def load_pipeline(artifact_path: str):
    """
    Load the stacking pipeline. Tries joblib first, falls back to pickle.
    Raises RuntimeError with a clear message on failure — no silent fallback.
    """
    path = Path(artifact_path).resolve()
    if not path.exists():
        raise RuntimeError(f"Artifact not found at: {path}")

    # Try joblib first (preferred — handles numpy arrays better)
    try:
        import joblib
        pipeline = joblib.load(path)
        log.info(f"Loaded via joblib: {path}")
        return pipeline
    except Exception as jl_err:
        log.warning(f"joblib load failed ({jl_err}), retrying with pickle")

    # Fallback to pickle
    try:
        import pickle
        with open(path, "rb") as f:
            pipeline = pickle.load(f)
        log.info(f"Loaded via pickle: {path}")
        return pipeline
    except Exception as pk_err:
        raise RuntimeError(
            f"Failed to load artifact with both joblib and pickle.\n"
            f"  joblib error: {jl_err}\n"
            f"  pickle error: {pk_err}"
        )


def validate_pipeline(pipeline: dict):
    """Verify the pipeline dict has the expected keys."""
    required = ["xgb_model", "lgb_model", "cat_model", "meta_learner", "calibrator", "threshold", "features"]
    missing = [k for k in required if k not in pipeline]
    if missing:
        raise RuntimeError(f"Pipeline missing keys: {missing}")


# ── Feature preparation ───────────────────────────────────────────────────────

def prepare_features(raw_features: dict) -> pd.DataFrame:
    """
    Build a single-row DataFrame in the exact feature order expected by the model.
    - Missing features are filled with FEATURE_DEFAULTS and logged as warnings.
    - Type-casts all values to float64.
    - Raises ValueError if a value cannot be cast.
    """
    row = {}
    missing_logged = []

    for name in FEATURE_NAMES:
        if name in raw_features:
            raw_val = raw_features[name]
        else:
            raw_val = FEATURE_DEFAULTS[name]
            missing_logged.append(name)

        try:
            row[name] = float(raw_val)
        except (TypeError, ValueError) as e:
            raise ValueError(f"Feature '{name}' cannot be cast to float: {raw_val!r} — {e}")

    if missing_logged:
        log.warning(f"Features filled with defaults ({len(missing_logged)}): {missing_logged}")

    df = pd.DataFrame([row], columns=FEATURE_NAMES)

    # Final sanity check — no NaN allowed
    nan_cols = df.columns[df.isnull().any()].tolist()
    if nan_cols:
        raise ValueError(f"NaN values in prepared features: {nan_cols}")

    return df


# ── Inference ─────────────────────────────────────────────────────────────────

def risk_level_from_probability(prob: float) -> str:
    if prob >= 0.60:
        return "HIGH"
    if prob >= 0.35:
        return "MEDIUM"
    return "LOW"


def run_inference(pipeline: dict, df: pd.DataFrame) -> float:
    """Run the stacking ensemble and return calibrated default probability."""
    xgb_model = pipeline["xgb_model"]
    lgb_model = pipeline["lgb_model"]
    cat_model = pipeline["cat_model"]
    meta = pipeline["meta_learner"]
    calibrator = pipeline["calibrator"]

    # Get base-model probabilities
    p_xgb = xgb_model.predict_proba(df)[:, 1]
    p_lgb = lgb_model.predict_proba(df)[:, 1]
    p_cat = cat_model.predict_proba(df)[:, 1]

    stack_input = np.column_stack([p_xgb, p_lgb, p_cat])
    raw_prob = meta.predict_proba(stack_input)[:, 1]

    # Calibrate — calibrator may be isotonic/Platt (returns array)
    calibrated = calibrator.predict(raw_prob)
    prob = float(np.clip(calibrated[0], 0.01, 0.99))

    log.info(f"Base probs — xgb={p_xgb[0]:.4f} lgb={p_lgb[0]:.4f} cat={p_cat[0]:.4f} → calibrated={prob:.4f}")
    return prob


# ── SHAP explanations ─────────────────────────────────────────────────────────

def get_shap_explanation(pipeline: dict, df: pd.DataFrame, top_n: int = 5) -> dict:
    """
    Compute SHAP values using TreeExplainer on the XGB base model.
    Returns { "type": "shap", "top_features": [ { "feature": str, "impact": float } ] }
    Falls back to feature-importance ranking on failure (clearly labeled).
    """
    try:
        import shap
        xgb_model = pipeline["xgb_model"]
        explainer = shap.TreeExplainer(xgb_model)
        shap_values = explainer.shap_values(df)

        # shap_values shape: (1, n_features)
        sv = np.array(shap_values).flatten()
        pairs = sorted(
            zip(FEATURE_NAMES, sv),
            key=lambda x: abs(x[1]),
            reverse=True,
        )

        top_features = [
            {"feature": name, "impact": round(float(val), 6)}
            for name, val in pairs[:top_n]
        ]
        log.info("SHAP explanation computed successfully")
        return {"type": "shap", "top_features": top_features}

    except ImportError:
        log.warning("shap not installed — using feature-importance fallback")
    except Exception as e:
        log.warning(f"SHAP failed ({e}) — using feature-importance fallback")

    # Fallback: use XGB feature importances
    try:
        xgb_model = pipeline["xgb_model"]
        importances = xgb_model.feature_importances_
        pairs = sorted(
            zip(FEATURE_NAMES, importances),
            key=lambda x: abs(x[1]),
            reverse=True,
        )
        top_features = [
            {"feature": name, "impact": round(float(val), 6)}
            for name, val in pairs[:top_n]
        ]
        log.warning("Using feature-importance fallback for explanation")
        return {"type": "fallback_feature_importance", "top_features": top_features}

    except Exception as fe:
        log.error(f"Feature importance fallback also failed: {fe}")
        return {
            "type": "fallback_unavailable",
            "top_features": [],
            "error": str(fe),
        }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        _fail("Missing artifact path argument", "MISSING_ARTIFACT_ARG")

    artifact_path = sys.argv[1]

    # Read JSON input from stdin
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            _fail("Empty stdin — expected JSON payload", "EMPTY_INPUT")
        payload = json.loads(raw_input)
    except json.JSONDecodeError as e:
        _fail(f"Invalid JSON input: {e}", "INVALID_JSON")

    raw_features = payload.get("features", {})

    # Prepare features first (validates input, logs defaults) — before loading model
    # so feature errors surface clearly even if model load would also fail.
    try:
        df = prepare_features(raw_features)
    except ValueError as e:
        _fail(str(e), "FEATURE_PREPARATION_FAILED")

    # Load model
    try:
        pipeline = load_pipeline(artifact_path)
        validate_pipeline(pipeline)
    except RuntimeError as e:
        _fail(str(e), "MODEL_LOAD_FAILED")

    # Run inference
    try:
        probability = run_inference(pipeline, df)
    except Exception as e:
        log.error(traceback.format_exc())
        _fail(f"Inference error: {e}", "INFERENCE_FAILED")

    risk_level = risk_level_from_probability(probability)

    # SHAP explanation (non-fatal — but labeled clearly)
    explanation = get_shap_explanation(pipeline, df)

    result = {
        "probability": round(probability, 6),
        "risk_level": risk_level,
        "explanation_type": explanation["type"],
        "top_features": explanation["top_features"],
    }

    print(json.dumps(result))
    sys.exit(0)


def _fail(message: str, error_code: str):
    """Emit a structured error JSON to stdout and exit non-zero."""
    log.error(f"[{error_code}] {message}")
    print(json.dumps({"error": message, "error_code": error_code}))
    sys.exit(1)


if __name__ == "__main__":
    main()