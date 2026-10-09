import pandas as pd
import numpy as np
import joblib

from backend.risk_engine import calculate_risk


MODEL_PATH = "models/comparison/xgboost.pkl"

LABEL_ENCODER_PATH = (
    "models/comparison/label_encoder.pkl"
)


# --------------------------------------------------
# LOAD MODEL
# --------------------------------------------------

model = joblib.load(
    MODEL_PATH
)

label_encoder = joblib.load(
    LABEL_ENCODER_PATH
)


FEATURE_COLUMNS = model.feature_names_in_


print(
    "XGBoost model loaded successfully."
)

print(
    f"Model expects {len(FEATURE_COLUMNS)} features."
)


# --------------------------------------------------
# PREDICTION FUNCTION
# --------------------------------------------------

def predict_threat(features):

    # Convert input into DataFrame
    data = pd.DataFrame(
        [features]
    )


    # Make sure columns match model
    data = data.reindex(
        columns=FEATURE_COLUMNS
    )


    # Replace infinity
    data = data.replace(
        [np.inf, -np.inf],
        np.nan
    )


    # Convert values to numbers
    data = data.apply(
        pd.to_numeric,
        errors="coerce"
    )


    # Handle missing values
    data = data.fillna(0)


    # --------------------------------------------------
    # MODEL PREDICTION
    # --------------------------------------------------

    predicted_class = model.predict(
        data
    )[0]


    prediction = label_encoder.inverse_transform(
        [predicted_class]
    )[0]


    # --------------------------------------------------
    # MODEL CONFIDENCE
    # --------------------------------------------------

    probabilities = model.predict_proba(
        data
    )[0]


    confidence = float(
        max(probabilities)
    )


    # --------------------------------------------------
    # RISK ENGINE
    # --------------------------------------------------

    risk_result = calculate_risk(
        prediction,
        confidence
    )


    # --------------------------------------------------
    # FINAL RESULT
    # --------------------------------------------------

    return {

        "prediction":
            prediction,

        "confidence":
            confidence,

        "risk_score":
            risk_result["risk_score"],

        "severity":
            risk_result["severity"]

    }


# --------------------------------------------------
# LOCAL TEST
# --------------------------------------------------

if __name__ == "__main__":

    print(
        "\nRunning XGBoost prediction test..."
    )


    df = pd.read_csv(
        "data/processed_cic_ids2017.csv"
    )


    attack_row = df[
        df["Label"] == "DoS Hulk"
    ].iloc[0]


    sample = (
        attack_row
        .drop("Label")
        .to_dict()
    )


    result = predict_threat(
        sample
    )


    print(
        "\nPrediction Result:"
    )

    print(
        result
    )