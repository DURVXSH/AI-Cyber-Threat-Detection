
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
from collections import Counter
import pandas as pd
import numpy as np
import traceback
import json
from pathlib import Path

from backend.risk_engine import calculate_risk
from ml.explain_prediction import explain_prediction

from backend.model_performance import (
    get_model_comparison,
    get_classification_report,
)

from ml.xgboost_predict import (
    predict_threat,
    model,
    label_encoder,
    FEATURE_COLUMNS
)

from backend.analytics import (
    get_dataset_statistics,
    get_model_performance,
    get_security_summary
)

from backend.database import (
    initialize_database,
    save_threat,
    get_threat_history,
    get_threat_statistics,
    clear_history
)


app = FastAPI(
    title="AI Cyber Threat Detection Platform",
    description="AI-powered network threat detection using XGBoost",
    version="3.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# DATABASE INITIALIZATION
# --------------------------------------------------

initialize_database()


# --------------------------------------------------
# ROOT
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "AI Cyber Threat Detection Platform API is running!",
        "status": "online",
        "model": "XGBoost"
    }


# --------------------------------------------------
# HEALTH
# --------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "XGBoost",
        "dataset": "CIC-IDS2017",
        "features": len(FEATURE_COLUMNS),
        "message": "XGBoost threat detection service is ready"
    }


# --------------------------------------------------
# SINGLE PREDICTION
# --------------------------------------------------

@app.post("/predict")
def predict(data: Dict[str, Any]):
    try:
        result = predict_threat(data)

        save_threat(
            prediction=result["prediction"],
            confidence=result["confidence"],
            risk_score=result["risk_score"],
            severity=result["severity"],
            source="Single Detection"
        )

        return {
            "success": True,
            "prediction": result["prediction"],
            "confidence": result["confidence"],
            "risk_score": result["risk_score"],
            "severity": result["severity"]
        }

    except Exception as error:
        traceback.print_exc()
        return {
            "success": False,
            "error": str(error)
        }


# --------------------------------------------------
# CSV BATCH PREDICTION
# --------------------------------------------------

@app.post("/predict-csv")
async def predict_csv(file: UploadFile = File(...)):
    try:
        print("\n========================================")
        print("CSV PREDICTION REQUEST RECEIVED")
        print("Filename:", file.filename)
        print("========================================")

        if not file.filename:
            return {
                "success": False,
                "error": "No file was provided."
            }

        if not file.filename.lower().endswith(".csv"):
            return {
                "success": False,
                "error": "Only CSV files are supported."
            }

        # Check that the uploaded file is not empty.
        first_byte = await file.read(1)

        if not first_byte:
            return {
                "success": False,
                "error": "The uploaded CSV is empty."
            }

        await file.seek(0)

        # Read the column names only.
        header = pd.read_csv(file.file, nrows=0)
        header.columns = [
            str(column).strip()
            for column in header.columns
        ]

        missing_features = [
            feature
            for feature in FEATURE_COLUMNS
            if feature not in header.columns
        ]

        if missing_features:
            return {
                "success": False,
                "error": (
                    "The uploaded CSV does not contain "
                    "all required CIC-IDS2017 features."
                ),
                "missing_features": missing_features[:20]
            }

        # Process the file incrementally.
        await file.seek(0)

        chunks = pd.read_csv(
            file.file,
            chunksize=20000
        )

        total_records = 0
        benign_records = 0

        attack_counts = Counter()
        severity_counts = Counter()
        results_preview = []

        for batch_number, df in enumerate(chunks, start=1):
            df.columns = [
                str(column).strip()
                for column in df.columns
            ]

            if df.empty:
                continue

            X = df[FEATURE_COLUMNS].copy()

            X = X.replace(
                [np.inf, -np.inf],
                np.nan
            )

            X = X.apply(
                pd.to_numeric,
                errors="coerce"
            )

            X = X.fillna(0)

            # Predict this batch only.
            predictions = model.predict(X)

            probabilities = model.predict_proba(X)

            predicted_labels = label_encoder.inverse_transform(
                predictions.astype(int)
            )

            confidence_values = probabilities.max(axis=1)

            risks = []
            severities = []

            for label, confidence in zip(
                predicted_labels,
                confidence_values
            ):
                risk = calculate_risk(
                    str(label),
                    float(confidence)
                )

                risks.append(risk["risk_score"])
                severities.append(risk["severity"])

            # Update aggregate statistics.
            batch_total = len(df)
            total_records += batch_total

            for label, confidence, risk_score, severity in zip(
                predicted_labels,
                confidence_values,
                risks,
                severities
            ):
                label = str(label)
                severity = str(severity)

                if label == "BENIGN":
                    benign_records += 1
                else:
                    attack_counts[label] += 1

                    # Retain existing behavior: save threats only.
                    save_threat(
                        prediction=label,
                        confidence=float(confidence),
                        risk_score=int(risk_score),
                        severity=severity,
                        source=file.filename
                    )

                severity_counts[severity] += 1

            # Keep only the first 100 prediction results.
            remaining = 100 - len(results_preview)

            if remaining > 0:
                preview_count = min(
                    remaining,
                    len(predicted_labels)
                )

                for index in range(preview_count):
                    results_preview.append({
                        "Prediction": str(
                            predicted_labels[index]
                        ),
                        "Confidence": float(
                            confidence_values[index]
                        ),
                        "Risk Score": int(
                            risks[index]
                        ),
                        "Severity": str(
                            severities[index]
                        )
                    })

            print(
                f"Batch {batch_number} completed. "
                f"Total rows processed: {total_records}"
            )

        if total_records == 0:
            return {
                "success": False,
                "error": "The uploaded CSV contains no data rows."
            }

        threat_records = total_records - benign_records

        threat_percentage = round(
            (threat_records / total_records) * 100,
            2
        )

        print("CSV prediction completed.")
        print("Total:", total_records)
        print("Benign:", benign_records)
        print("Threats:", threat_records)
        print("========================================")

        return {
            "success": True,
            "filename": file.filename,
            "total_records": int(total_records),
            "benign_records": int(benign_records),
            "threat_records": int(threat_records),
            "threat_percentage": threat_percentage,
            "attack_types": {
                str(key): int(value)
                for key, value in attack_counts.items()
            },
            "severity_distribution": {
                str(key): int(value)
                for key, value in severity_counts.items()
            },
            "results_preview": results_preview
        }

    except Exception as error:
        print("\nCSV PREDICTION ERROR")
        traceback.print_exc()

        return {
            "success": False,
            "error": str(error)
        }


# --------------------------------------------------
# TEST PREDICTION
# --------------------------------------------------

@app.get("/test-predict")
def test_predict():
    dataset_path = "data/processed_cic_ids2017.csv"

    full_df = pd.read_csv(dataset_path)

    attack_rows = full_df[
        full_df["Label"] == "DoS Hulk"
    ]

    if attack_rows.empty:
        return {
            "success": False,
            "error": "No DoS Hulk sample was found in the dataset."
        }

    attack_row = attack_rows.iloc[0]

    actual_label = attack_row["Label"]

    features = (
        attack_row
        .drop("Label")
        .to_dict()
    )

    result = predict_threat(features)

    return {
        "actual_label": actual_label,
        "prediction": result["prediction"],
        "confidence": result["confidence"],
        "risk_score": result["risk_score"],
        "severity": result["severity"]
    }


# --------------------------------------------------
# ANALYTICS
# --------------------------------------------------

@app.get("/analytics")
def analytics():
    return get_dataset_statistics()


# --------------------------------------------------
# MODEL PERFORMANCE
# --------------------------------------------------

@app.get("/model-performance")
def model_performance():
    return get_model_performance()


# --------------------------------------------------
# SECURITY SUMMARY
# --------------------------------------------------

@app.get("/security-summary")
def security_summary():
    return get_security_summary()


# --------------------------------------------------
# THREAT HISTORY
# --------------------------------------------------

@app.get("/threat-history")
def threat_history():
    history = get_threat_history()
    statistics = get_threat_statistics()

    return {
        "success": True,
        "statistics": statistics,
        "history": history
    }


# --------------------------------------------------
# CLEAR THREAT HISTORY
# --------------------------------------------------

@app.delete("/threat-history")
def delete_threat_history():
    clear_history()

    return {
        "success": True,
        "message": "Threat history cleared successfully."
    }


# --------------------------------------------------
# EXPLAINABLE AI
# --------------------------------------------------

@app.post("/explain-csv")
async def explain_csv(file: UploadFile = File(...)):
    try:
        if (
            not file.filename
            or not file.filename.lower().endswith(".csv")
        ):
            return {
                "success": False,
                "error": "Please upload a CSV file."
            }

        # Only the first row is needed for the explanation.
        contents = await file.read()

        if not contents:
            return {
                "success": False,
                "error": "The uploaded file is empty."
            }

        df = pd.read_csv(
            __import__("io").BytesIO(contents),
            nrows=1
        )

        df.columns = [
            str(column).strip()
            for column in df.columns
        ]

        if df.empty:
            return {
                "success": False,
                "error": "The CSV contains no data rows."
            }

        missing = [
            feature
            for feature in FEATURE_COLUMNS
            if feature not in df.columns
        ]

        if missing:
            return {
                "success": False,
                "error": (
                    "The CSV must contain all required "
                    "CIC-IDS2017 features."
                ),
                "missing_features": missing[:20]
            }

        features = df.iloc[0][FEATURE_COLUMNS].to_dict()

        result = explain_prediction(features)

        return {
            "success": True,
            "filename": file.filename,
            "row_explained": 1,
            **result
        }

    except Exception as error:
        traceback.print_exc()

        return {
            "success": False,
            "error": str(error)
        }


# --------------------------------------------------
# MODEL COMPARISON
# --------------------------------------------------

@app.get("/model-comparison")
def model_comparison():
    return get_model_comparison()


# --------------------------------------------------
# CLASSIFICATION REPORT
# --------------------------------------------------

@app.get("/classification-report")
def classification_report():
    return get_classification_report()


# --------------------------------------------------
# CONFUSION MATRIX
# --------------------------------------------------

@app.get("/confusion-matrix")
def get_confusion_matrix():
    project_root = Path(__file__).resolve().parent.parent

    matrix_path = (
        project_root
        / "models"
        / "comparison"
        / "xgboost_confusion_matrix.json"
    )

    if not matrix_path.exists():
        return {
            "success": False,
            "error": (
                "Confusion matrix file not found. "
                "Generate it first."
            )
        }

    try:
        with matrix_path.open(
            "r",
            encoding="utf-8"
        ) as file:
            return json.load(file)

    except (OSError, json.JSONDecodeError) as error:
        return {
            "success": False,
            "error": str(error)
        }
