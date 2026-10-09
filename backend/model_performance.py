
from pathlib import Path
import json

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parent.parent
COMPARISON_PATH = (
    PROJECT_ROOT / "models" / "comparison" / "model_comparison.csv"
)
CLASSIFICATION_REPORT_PATH = (
    PROJECT_ROOT / "models" / "classification_report.json"
)


def get_model_comparison():
    if not COMPARISON_PATH.exists():
        return {
            "success": False,
            "error": "Model comparison CSV was not found.",
            "models": [],
        }

    df = pd.read_csv(COMPARISON_PATH)
    df.columns = [str(column).strip() for column in df.columns]

    required = [
        "Model",
        "Accuracy",
        "Macro Precision",
        "Macro Recall",
        "Macro F1",
        "Weighted F1",
        "Training Time (sec)",
        "Prediction Time (sec)",
    ]

    missing = [column for column in required if column not in df.columns]

    if missing:
        return {
            "success": False,
            "error": f"Missing columns in comparison CSV: {missing}",
            "models": [],
        }

    df = df[required].copy()

    numeric_columns = required[1:]
    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(subset=["Model", "Accuracy", "Macro F1"])

    # Metrics are stored as fractions; return percentages for charts.
    models = []

    for _, row in df.iterrows():
        models.append({
            "model": str(row["Model"]),
            "accuracy": round(float(row["Accuracy"]) * 100, 3),
            "macro_precision": round(
                float(row["Macro Precision"]) * 100, 3
            ),
            "macro_recall": round(
                float(row["Macro Recall"]) * 100, 3
            ),
            "macro_f1": round(float(row["Macro F1"]) * 100, 3),
            "weighted_f1": round(
                float(row["Weighted F1"]) * 100, 3
            ),
            "training_time_seconds": round(
                float(row["Training Time (sec)"]), 2
            ),
            "prediction_time_seconds": round(
                float(row["Prediction Time (sec)"]), 3
            ),
        })

    models.sort(key=lambda item: item["macro_f1"], reverse=True)

    best_model = models[0] if models else None

    return {
        "success": True,
        "models": models,
        "best_model": best_model,
        "metric_note": (
            "Accuracy, precision, recall and F1 are percentages. "
            "Training and prediction times use the saved benchmark "
            "results and depend on the original test environment."
        ),
    }


def get_classification_report():
    if not CLASSIFICATION_REPORT_PATH.exists():
        return {
            "success": False,
            "error": "Classification report JSON was not found.",
        }

    try:
        with CLASSIFICATION_REPORT_PATH.open(
            "r", encoding="utf-8"
        ) as file:
            report = json.load(file)

        return {
            "success": True,
            "report": report,
        }

    except (OSError, json.JSONDecodeError) as error:
        return {
            "success": False,
            "error": str(error),
        }
