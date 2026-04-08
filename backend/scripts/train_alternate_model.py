"""
Train a small GradientBoosting model for unbanked alternate-data default risk.
Outputs: backend/models/alternate/alternate_risk_pipeline.pkl
Feature order must match alternateFeatureBuilder.js ALTERNATE_ML_FEATURE_NAMES.
"""
import json
import pickle
import random
from pathlib import Path

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "models" / "alternate"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_NAMES = [
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
]

SEED = 42
random.seed(SEED)
np.random.seed(SEED)


def synth_row():
    cfs = np.random.random()
    pdisc = np.random.random()
    cap = np.random.random()
    comp = np.random.random()
    hist = np.random.random()
    has_upi = np.random.randint(0, 2)
    has_util = np.random.randint(0, 2)
    has_ad_upi = np.random.randint(0, 2)
    has_ad_ut = np.random.randint(0, 2)
    qual = np.random.randint(0, 3)
    lti = np.random.random() * 1.5
    fraud = np.random.random()
    trust = np.random.random()
    gap = np.random.random()
    hint_u = np.random.randint(0, 2)
    hint_t = np.random.randint(0, 2)
    return [
        cfs,
        pdisc,
        cap,
        comp,
        hist,
        has_upi,
        has_util,
        has_ad_upi,
        has_ad_ut,
        qual,
        lti,
        fraud,
        trust,
        gap,
        hint_u,
        hint_t,
    ]


def label_row(row):
    (
        cfs,
        pdisc,
        cap,
        comp,
        hist,
        has_upi,
        has_util,
        has_ad_upi,
        has_ad_ut,
        qual,
        lti,
        fraud,
        trust,
        gap,
        _,
        _,
    ) = row
    z = (
        1.2 * (1 - cfs)
        + 1.1 * (1 - pdisc)
        + 1.0 * (1 - cap)
        + 0.6 * (1 - comp)
        + 0.4 * (1 - hist)
        + 0.25 * (1 - has_upi)
        + 0.2 * (1 - has_util)
        + 0.35 * (1 - has_ad_upi)
        + 0.3 * (1 - has_ad_ut)
        + 0.15 * (2 - qual)
        + 0.9 * min(lti, 1.5)
        + 0.8 * fraud
        + 0.5 * (1 - trust)
        + 0.4 * gap
    )
    p_bad = 1 / (1 + np.exp(-(z - 3.2)))
    return 1 if np.random.random() < p_bad else 0


def main():
    n = 6000
    X = np.array([synth_row() for _ in range(n)], dtype=float)
    y = np.array([label_row(row) for row in X], dtype=int)

    model = GradientBoostingClassifier(random_state=SEED, max_depth=3, n_estimators=80)
    model.fit(X, y)

    bundle = {"model": model, "feature_names": FEATURE_NAMES}
    out_path = OUT_DIR / "alternate_risk_pipeline.pkl"
    with out_path.open("wb") as f:
        pickle.dump(bundle, f)

    card = {
        "artifact": str(out_path),
        "n_samples": n,
        "features": FEATURE_NAMES,
        "label": "synthetic_default_risk_unbanked",
        "note": "Demo only — not for production credit decisions.",
    }
    with (OUT_DIR / "alternate_model_card.json").open("w", encoding="utf-8") as f:
        json.dump(card, f, indent=2)

    print("Saved", out_path)


if __name__ == "__main__":
    main()
