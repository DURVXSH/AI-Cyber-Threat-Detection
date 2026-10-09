
import numpy as np
import pandas as pd
import shap

from ml.xgboost_predict import (
    model,
    label_encoder,
    FEATURE_COLUMNS,
)


explainer = shap.TreeExplainer(model)


def explain_prediction(features, top_n=10):
    """Explain one XGBoost prediction using SHAP values."""

    data = pd.DataFrame([features])
    data = data.reindex(columns=FEATURE_COLUMNS)

    data = data.replace([np.inf, -np.inf], np.nan)
    data = data.apply(pd.to_numeric, errors="coerce")
    data = data.fillna(0)

    predicted_class = int(model.predict(data)[0])
    prediction = str(
        label_encoder.inverse_transform([predicted_class])[0]
    )

    probabilities = model.predict_proba(data)[0]
    confidence = float(probabilities[predicted_class])

    raw_values = explainer.shap_values(data)

    # SHAP output formats differ across versions and models.
    if isinstance(raw_values, list):
        class_values = np.asarray(raw_values[predicted_class])[0]

    else:
        values = np.asarray(raw_values)

        if values.ndim == 3:
            # Shape: samples x features x classes
            if values.shape[1] == len(FEATURE_COLUMNS):
                class_values = values[0, :, predicted_class]

            # Alternative shape: samples x classes x features
            elif values.shape[2] == len(FEATURE_COLUMNS):
                class_values = values[0, predicted_class, :]

            else:
                raise ValueError(
                    f"Unexpected SHAP output shape: {values.shape}"
                )

        elif values.ndim == 2:
            class_values = values[0]

        else:
            raise ValueError(
                f"Unexpected SHAP output shape: {values.shape}"
            )

    class_values = np.asarray(class_values).reshape(-1)

    if len(class_values) != len(FEATURE_COLUMNS):
        raise ValueError(
            "SHAP values do not match the model feature count."
        )

    feature_values = data.iloc[0].to_numpy()

    contributions = []

    for name, value, contribution in zip(
        FEATURE_COLUMNS,
        feature_values,
        class_values,
    ):
        contributions.append({
            "feature": str(name),
            "value": float(value) if np.isfinite(value) else None,
            "shap_value": float(contribution),
            "impact": (
                "Supports this prediction"
                if contribution > 0
                else "Opposes this prediction"
                if contribution < 0
                else "No contribution"
            ),
            "magnitude": abs(float(contribution)),
        })

    contributions.sort(
        key=lambda item: item["magnitude"],
        reverse=True,
    )

    return {
        "prediction": prediction,
        "confidence": confidence,
        "explainer": "SHAP TreeExplainer",
        "explanation_note": (
            "Positive SHAP values support the predicted class; "
            "negative values oppose it. Values are relative to the "
            "model's SHAP baseline for that class."
        ),
        "top_features": contributions[:top_n],
    }
