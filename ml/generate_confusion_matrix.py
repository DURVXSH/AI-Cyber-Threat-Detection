
from pathlib import Path
import json
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, accuracy_score

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "processed_cic_ids2017.csv"
MODEL_PATH = ROOT / "models" / "comparison" / "xgboost.pkl"
ENCODER_PATH = ROOT / "models" / "comparison" / "label_encoder.pkl"
OUTPUT_PATH = ROOT / "models" / "comparison" / "xgboost_confusion_matrix.json"

TEST_SIZE = 0.2
RANDOM_STATE = 42


def clean_label(label):
    """Fix corrupted characters in Web Attack class names for display."""
    label = str(label).strip()

    replacements = {
        "Web Attack � Brute Force": "Web Attack - Brute Force",
        "Web Attack � Sql Injection": "Web Attack - Sql Injection",
        "Web Attack � XSS": "Web Attack - XSS",
    }

    return replacements.get(label, label)



def main():
    start = time.time()

    print("Loading dataset...")
    df = pd.read_csv(DATA_PATH)
    df.columns = df.columns.str.strip()
    df["Label"] = df["Label"].astype(str).str.strip()
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.drop_duplicates()

    X = df.drop("Label", axis=1)
    y = df["Label"]

    for column in X.columns:
        X[column] = pd.to_numeric(X[column], errors="coerce")

    encoder = joblib.load(ENCODER_PATH)
    model = joblib.load(MODEL_PATH)

    # Use the saved encoder to preserve the original label mapping.
    y_encoded = encoder.transform(y)

    # Reproduce the split used by the original model-comparison script.
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y_encoded,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y_encoded,
    )

    print(f"Training rows for imputer: {len(X_train):,}")
    print(f"Test rows: {len(X_test):,}")

    imputer = SimpleImputer(strategy="median")

    X_train_imputed = imputer.fit_transform(X_train)
    X_test_imputed = imputer.transform(X_test)

    # Restore feature names in case the model checks them.
    X_test_imputed = pd.DataFrame(
        X_test_imputed,
        columns=X.columns,
        index=X_test.index,
    )

    print("Generating XGBoost predictions...")
    y_pred = model.predict(X_test_imputed)

    labels = np.arange(len(encoder.classes_))
    matrix = confusion_matrix(
        y_test,
        y_pred,
        labels=labels,
    )

    result = {
        "success": True,
        "model": "XGBoost",
        "accuracy_percent": round(
            float(accuracy_score(y_test, y_pred)) * 100, 3
        ),
        "class_labels": [clean_label(label) for label in encoder.classes_],
        "matrix": matrix.tolist(),
        "test_samples": int(len(y_test)),
        "correct_predictions": int(np.trace(matrix)),
        "incorrect_predictions": int(matrix.sum() - np.trace(matrix)),
        "note": (
            "Rows are actual classes; columns are predicted classes. "
            "Diagonal cells are correct predictions."
        ),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as file:
        json.dump(result, file, indent=2)

    print(f"Confusion matrix saved to: {OUTPUT_PATH}")
    print(f"Accuracy on reconstructed split: {result['accuracy_percent']}%")
    print(f"Test samples: {result['test_samples']:,}")
    print(f"Elapsed time: {time.time() - start:.1f} seconds")


if __name__ == "__main__":
    main()
