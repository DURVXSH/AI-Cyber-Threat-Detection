import pandas as pd
import numpy as np
import joblib


# ==========================================================
# 1. LOAD TRAINED MODEL
# ==========================================================

MODEL_PATH = "models/cyber_threat_model.pkl"

model = joblib.load(MODEL_PATH)

FEATURE_COLUMNS = model.feature_names_in_

print(
    f"Cyber threat model loaded successfully."
)

print(
    f"Model expects {len(FEATURE_COLUMNS)} features."
)


# ==========================================================
# 2. PREDICTION FUNCTION
# ==========================================================

def predict_threat(features):

    # Convert incoming features into a DataFrame
    data = pd.DataFrame([features])


    # Make sure the features are in exactly
    # the same order used during training
    data = data.reindex(
        columns=FEATURE_COLUMNS
    )


    # Convert infinite values to NaN
    data = data.replace(
        [np.inf, -np.inf],
        np.nan
    )


    # Convert values to numeric
    data = data.apply(
        pd.to_numeric,
        errors="coerce"
    )


    # Fill missing values
    data = data.fillna(0)


    # ======================================================
    # 3. MODEL PREDICTION
    # ======================================================

    prediction = model.predict(data)[0]

    probabilities = model.predict_proba(data)[0]


    # Highest probability = model confidence
    confidence = float(
        max(probabilities)
    )


    # ======================================================
    # 4. RISK ASSESSMENT
    # ======================================================

    if prediction == "BENIGN":

        risk_score = 0
        severity = "LOW"

    elif confidence >= 0.90:

        risk_score = 90
        severity = "CRITICAL"

    elif confidence >= 0.75:

        risk_score = 70
        severity = "HIGH"

    else:

        risk_score = 40
        severity = "MEDIUM"


    # ======================================================
    # 5. RETURN RESULT
    # ======================================================

    return {
        "prediction": prediction,
        "confidence": confidence,
        "risk_score": risk_score,
        "severity": severity
    }


# ==========================================================
# 6. LOCAL TEST
# ==========================================================

if __name__ == "__main__":

    print("\nRunning local prediction test...")

    df = pd.read_csv(
        "data/processed_cic_ids2017.csv"
    )


    # Select a known DoS Hulk example
    attack_row = df[
        df["Label"] == "DoS Hulk"
    ].iloc[0]


    # Remove the target label
    sample = attack_row.drop(
        "Label"
    ).to_dict()


    # Run prediction
    result = predict_threat(sample)


    print("\nPrediction Result:")
    print(result)