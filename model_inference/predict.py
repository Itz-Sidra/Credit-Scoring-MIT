import pickle
import numpy as np
import pandas as pd

# Load the pipeline – file is in the same directory
with open("stacking_pipeline.pkl", "rb") as f:
    pipeline = pickle.load(f)

xgb_model = pipeline["xgb_model"]
lgb_model = pipeline["lgb_model"]
cat_model = pipeline["cat_model"]
meta = pipeline["meta_learner"]
calibrator = pipeline["calibrator"]
threshold = pipeline["threshold"]
features = pipeline["features"]

print(f"✅ Model loaded. Threshold = {threshold:.4f}")

sample_data = {
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

sample_df = pd.DataFrame([sample_data])[features]

p_xgb = xgb_model.predict_proba(sample_df)[:, 1]
p_lgb = lgb_model.predict_proba(sample_df)[:, 1]
p_cat = cat_model.predict_proba(sample_df)[:, 1]
stack_input = np.column_stack([p_xgb, p_lgb, p_cat])
raw = meta.predict_proba(stack_input)[:, 1]
calibrated = calibrator.predict(raw)
decision = (calibrated >= threshold).astype(int)

print(f"Default probability: {calibrated[0]:.4f}")
print(f"Decision: {'Default' if decision[0] else 'No Default'}")