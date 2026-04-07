#!/usr/bin/env python3
import json
import pickle
import sys
from pathlib import Path


def _find_model_in_artifact(artifact):
    if hasattr(artifact, "predict_proba"):
        return artifact

    if isinstance(artifact, dict):
        preferred_keys = [
            "model",
            "estimator",
            "pipeline",
            "classifier",
            "calibrated_model",
            "best_model",
        ]
        for key in preferred_keys:
            candidate = artifact.get(key)
            if hasattr(candidate, "predict_proba"):
                return candidate

        for candidate in artifact.values():
            if hasattr(candidate, "predict_proba"):
                return candidate

    return None


def _extract_feature_metadata(artifact, model):
    feature_names = None
    feature_defaults = {}

    if isinstance(artifact, dict):
        feature_names = (
            artifact.get("feature_names")
            or artifact.get("features")
            or artifact.get("serving_features")
        )
        feature_defaults = (
            artifact.get("feature_defaults") or artifact.get("defaults") or {}
        )

    if not feature_names and hasattr(model, "feature_names_in_"):
        feature_names = list(model.feature_names_in_)

    if feature_names is None:
        feature_names = []

    return list(feature_names), feature_defaults


def _coerce(value):
    if value is None:
        return None
    if isinstance(value, (int, float, bool)):
        return value

    text = str(value).strip()
    if text == "":
        return None

    lowered = text.lower()
    if lowered in ("true", "false"):
        return lowered == "true"

    try:
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return value


def _build_input_row(features, feature_names, feature_defaults):
    if feature_names:
        row = {}
        for name in feature_names:
            if name in features:
                row[name] = _coerce(features.get(name))
            else:
                row[name] = _coerce(feature_defaults.get(name, 0))
        return row, feature_names

    keys = sorted(features.keys())
    row = {key: _coerce(features.get(key)) for key in keys}
    return row, keys


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing artifact path"}))
        sys.exit(1)

    artifact_path = Path(sys.argv[1]).resolve()
    if not artifact_path.exists():
        print(json.dumps({"error": f"Artifact not found: {artifact_path}"}))
        sys.exit(1)

    payload = json.loads(sys.stdin.read() or "{}")
    features = payload.get("features") or {}

    with artifact_path.open("rb") as handle:
        artifact = pickle.load(handle)

    model = _find_model_in_artifact(artifact)
    if model is None:
        print(json.dumps({"error": "No model with predict_proba found in artifact"}))
        sys.exit(1)

    feature_names, feature_defaults = _extract_feature_metadata(artifact, model)
    row, ordered_columns = _build_input_row(features, feature_names, feature_defaults)

    try:
        import pandas as pd

        dataframe = pd.DataFrame([row], columns=ordered_columns)
        probability = float(model.predict_proba(dataframe)[0][1])
    except Exception:
        ordered_values = [[row[column] for column in ordered_columns]]
        probability = float(model.predict_proba(ordered_values)[0][1])

    print(
        json.dumps(
            {
                "probability": probability,
                "n_features_used": len(ordered_columns),
                "model_type": model.__class__.__name__,
            }
        )
    )


if __name__ == "__main__":
    main()
