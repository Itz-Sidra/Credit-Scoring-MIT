#!/usr/bin/env python3
"""Alternate unbanked risk: predict default probability + SHAP (TreeExplainer)."""
import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing artifact path"}))
        sys.exit(1)

    artifact_path = Path(sys.argv[1]).resolve()
    if not artifact_path.exists():
        print(json.dumps({"error": f"Artifact not found: {artifact_path}"}))
        sys.exit(1)

    payload = json.loads(sys.stdin.read() or "{}")
    mode = payload.get("mode") or "explain"
    feats = payload.get("features") or {}

    with artifact_path.open("rb") as f:
        bundle = pickle.load(f)

    feature_names = bundle.get("feature_names") or []
    model = bundle.get("model")
    if model is None or not hasattr(model, "predict_proba"):
        print(json.dumps({"error": "Invalid bundle: no model"}))
        sys.exit(1)

    row = []
    for name in feature_names:
        v = feats.get(name, 0)
        try:
            row.append(float(v))
        except (TypeError, ValueError):
            row.append(0.0)

    X = pd.DataFrame([row], columns=feature_names)
    proba_row = model.predict_proba(X)[0]
    classes = np.asarray(getattr(model, "classes_", [0, 1]))
    # Training uses label 1 = default (see train_alternate_model.py)
    if classes.size == 2 and np.any(classes == 1):
        idx = int(np.flatnonzero(classes == 1)[0])
        prob_bad = float(proba_row[idx])
    else:
        prob_bad = float(proba_row[-1])

    out = {
        "probability_default": prob_bad,
        "n_features_used": len(feature_names),
        "model_type": type(model).__name__,
    }

    if mode == "explain":
        try:
            import shap

            explainer = shap.TreeExplainer(model)
            sv = explainer.shap_values(X)
            if isinstance(sv, list):
                sv = sv[1] if len(sv) > 1 else sv[0]
            sv_row = np.array(sv).flatten()
            pairs = list(zip(feature_names, row, sv_row))
            pairs.sort(key=lambda x: abs(x[2]), reverse=True)
            top = []
            for name, val, shap_v in pairs[:12]:
                top.append(
                    {
                        "name": name,
                        "value": round(float(val), 6),
                        "shapValue": round(float(shap_v), 6),
                    }
               )
            out["shap"] = {
                "method": "shap_tree",
                "topFeatures": top,
                "expectedValue": float(getattr(explainer, "expected_value", 0) or 0),
            }
        except Exception as ex:
            out["shap"] = {
                "method": "unavailable",
                "error": str(ex),
                "topFeatures": [],
            }

    print(json.dumps(out))


if __name__ == "__main__":
    main()
