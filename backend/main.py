
"""FastAPI service for the AI Cyber Threat Detection System."""

from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any
import json
import logging
import os
import tempfile
import threading

import numpy as np
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from sklearn.metrics import confusion_matrix as sklearn_confusion_matrix
from sklearn.model_selection import train_test_split

from backend.risk_engine import calculate_risk
from backend.database import (
    initialize_database,
    save_threat,
    save_threats,
    get_threat_history,
    get_threat_statistics,
    clear_history,
)
from backend.analytics import (
    get_dataset_statistics,
    get_model_performance,
    get_security_summary,
    DATASET_PATH,
)
from backend.model_performance import (
    get_model_comparison,
    get_classification_report,
)
from ml.xgboost_predict import load_artifacts, predict_threat, predict_batch
from ml.explain_prediction import explain_prediction


# ---------------------------------------------------------
# Configuration — no application-level upload-size limit
# ---------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cyberguard")

PROJECT_ROOT = Path(__file__).resolve().parent.parent

CSV_JOB_PROGRESS = {}
CSV_PROGRESS_LOCK = threading.Lock()

CACHE_DIR = PROJECT_ROOT / "models" / "cache"
CONFUSION_CACHE_FILE = CACHE_DIR / "confusion_matrix.json"
CONFUSION_CACHE_VERSION = 1
CONFUSION_CACHE_LOCK = threading.Lock()

app = FastAPI(
    title="CyberGuard AI Threat Detection API",
    description=(
        "Explainable CIC-IDS2017 network-flow threat "
        "classification and risk triage."
    ),
    version="2.1.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

initialize_database()


# ---------------------------------------------------------
# Progress tracking
# ---------------------------------------------------------

def _set_csv_progress(job_id: str, **updates):
    with CSV_PROGRESS_LOCK:
        current = CSV_JOB_PROGRESS.get(job_id, {})
        current.update(updates)
        CSV_JOB_PROGRESS[job_id] = current


def _get_csv_progress(job_id: str):
    with CSV_PROGRESS_LOCK:
        progress = CSV_JOB_PROGRESS.get(job_id)

        if progress is None:
            return {
                "success": True,
                "status": "waiting",
                "processed": 0,
                "batch": 0,
                "message": "Waiting for CSV processing to begin.",
            }

        return {"success": True, **progress}


# ---------------------------------------------------------
# Model and CSV helpers
# ---------------------------------------------------------

def _artifacts_status():
    try:
        model, encoder, columns = load_artifacts()
        return {
            "available": True,
            "model": "XGBoost",
            "features": len(columns),
            "classes": len(getattr(encoder, "classes_", [])),
            "error": None,
        }
    except Exception as exc:
        return {
            "available": False,
            "model": "XGBoost",
            "features": 0,
            "classes": 0,
            "error": str(exc),
        }


def _validate_csv_name(file: UploadFile):
    """Validate the filename only; impose no application-level size limit."""
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file was provided.",
        )

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported.",
        )


async def _read_header(file: UploadFile):
    await file.seek(0)

    try:
        header = await run_in_threadpool(
            pd.read_csv,
            file.file,
            nrows=0,
            low_memory=False,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read CSV header: {exc}",
        )

    header.columns = [str(column).strip() for column in header.columns]
    return header


def _required_features():
    try:
        return load_artifacts()[2]
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Model artifacts are unavailable: {exc}",
        )


def _validate_columns(header, features):
    missing = [
        feature for feature in features
        if feature not in header.columns
    ]

    if missing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": (
                    "CSV is missing required model features. "
                    "Use the same CIC-IDS2017 feature schema "
                    "used during training."
                ),
                "missing_features": missing[:30],
            },
        )


# ---------------------------------------------------------
# General API endpoints
# ---------------------------------------------------------

@app.get("/")
def root():
    return {
        "success": True,
        "message": "CyberGuard AI Threat Detection API is running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    status = _artifacts_status()

    return {
        "status": "healthy" if status["available"] else "degraded",
        "model": status["model"],
        "model_available": status["available"],
        "dataset": "CIC-IDS2017",
        "features": status["features"],
        "classes": status["classes"],
        "message": (
            "Inference is ready."
            if status["available"]
            else "API is running, but model artifacts could not be loaded."
        ),
        "error": status["error"],
    }


@app.post("/predict")
def predict(data: dict[str, Any]):
    if not data:
        raise HTTPException(
            status_code=400,
            detail="Provide a JSON object containing feature values.",
        )

    result = predict_threat(data)

    save_threat(
        result["prediction"],
        result["confidence"],
        result["risk_score"],
        result["severity"],
        "Single Detection",
    )

    return {"success": True, **result}


# ---------------------------------------------------------
# Test prediction endpoint
# ---------------------------------------------------------

@lru_cache(maxsize=1)
def _find_test_sample():
    if not DATASET_PATH.exists():
        return None

    features = _required_features()

    for chunk in pd.read_csv(
        DATASET_PATH,
        chunksize=10000,
        low_memory=False,
    ):
        chunk.columns = [str(column).strip() for column in chunk.columns]

        if "Label" not in chunk.columns:
            return None

        attacks = chunk[
            chunk["Label"].astype(str).str.strip().str.upper() != "BENIGN"
        ]

        if not attacks.empty:
            return attacks.iloc[0][features].to_dict()

    return None


@app.get("/test-predict")
def test_predict():
    sample = _find_test_sample()

    if sample is None:
        return {
            "success": False,
            "error": (
                "No attack sample found. "
                "Ensure the processed dataset exists."
            ),
        }

    return {
        "success": True,
        "sample_label": "Sample from CIC-IDS2017",
        "result": predict_threat(sample),
    }


# ---------------------------------------------------------
# CSV progress endpoint
# ---------------------------------------------------------

@app.get("/predict-csv/progress/{job_id}")
def get_csv_progress(job_id: str):
    return _get_csv_progress(job_id)


# ---------------------------------------------------------
# CSV batch prediction
# ---------------------------------------------------------

@app.post("/predict-csv")
async def predict_csv(
    file: UploadFile = File(...),
    job_id: str = Form(default=""),
):
    job_id = job_id.strip() or __import__("uuid").uuid4().hex
    total = 0
    benign = 0
    attack_counts = Counter()
    severity_counts = Counter()
    preview = []
    batch_no = 0

    _set_csv_progress(
        job_id,
        status="processing",
        processed=0,
        batch=0,
        message="Validating CSV...",
    )

    logger.info("CSV job %s: upload processing started", job_id)

    try:
        _validate_csv_name(file)
        features = _required_features()
        header = await _read_header(file)
        _validate_columns(header, features)
        await file.seek(0)

        reader = pd.read_csv(
            file.file,
            chunksize=5000,
            low_memory=False,
        )

        for batch_no, df in enumerate(reader, start=1):
            df.columns = [str(column).strip() for column in df.columns]

            if df.empty:
                continue

            _set_csv_progress(
                job_id,
                status="processing",
                processed=total,
                batch=batch_no,
                message=f"Predicting batch {batch_no}...",
            )

            logger.info(
                "CSV job %s: starting inference for batch %d (%d rows)",
                job_id,
                batch_no,
                len(df),
            )

            labels, confidences, _ = await run_in_threadpool(
                predict_batch,
                df[features],
            )

            logger.info(
                "CSV job %s: inference completed for batch %d",
                job_id,
                batch_no,
            )

            if len(labels) != len(df) or len(confidences) != len(df):
                raise RuntimeError(
                    "Prediction output size does not match input batch size."
                )

            # Persist only actual threats, not benign network traffic.
            # All rows are included in the CSV summary.
            entries = []

            for label, confidence in zip(labels, confidences):
                label = str(label)
                confidence = float(confidence)

                if not np.isfinite(confidence):
                    confidence = 0.0

                risk = calculate_risk(label, confidence)
                total += 1

                if label.strip().upper() == "BENIGN":
                    benign += 1
                else:
                    attack_counts[label] += 1

                    entries.append({
                        "prediction": label,
                        "confidence": confidence,
                        "risk_score": risk["risk_score"],
                        "severity": risk["severity"],
                        "source": file.filename or "CSV Upload",
                    })

                severity_counts[risk["severity"]] += 1

                if len(preview) < 100:
                    preview.append({
                        "Prediction": label,
                        "Confidence": round(confidence, 6),
                        "Risk Score": risk["risk_score"],
                        "Severity": risk["severity"],
                    })

            if entries:
                logger.info(
                    "CSV job %s: saving %d threat records from batch %d",
                    job_id,
                    len(entries),
                    batch_no,
                )

                await run_in_threadpool(save_threats, entries)

                logger.info(
                    "CSV job %s: database save completed for batch %d",
                    job_id,
                    batch_no,
                )

            _set_csv_progress(
                job_id,
                status="processing",
                processed=total,
                batch=batch_no,
                message=(
                    f"Processed {total:,} records. "
                    "Continuing analysis..."
                ),
            )

            logger.info(
                "CSV job %s: batch %d completed, %d total rows",
                job_id,
                batch_no,
                total,
            )

        if total == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded CSV contains no data rows.",
            )

        threats = total - benign

        result = {
            "success": True,
            "filename": file.filename,
            "total_records": total,
            "benign_records": benign,
            "threat_records": threats,
            "threat_percentage": round(threats / total * 100, 2),
            "attack_types": dict(attack_counts),
            "severity_distribution": dict(severity_counts),
            "results_preview": preview,
        }

        _set_csv_progress(
            job_id,
            status="completed",
            processed=total,
            batch=batch_no,
            message="Analysis completed successfully.",
        )

        logger.info(
            "CSV job %s: completed; total=%d, benign=%d, threats=%d",
            job_id,
            total,
            benign,
            threats,
        )

        return result

    except HTTPException as exc:
        previous = _get_csv_progress(job_id)

        _set_csv_progress(
            job_id,
            status="failed",
            processed=previous.get("processed", 0),
            batch=previous.get("batch", 0),
            message=str(exc.detail),
        )
        raise

    except Exception as exc:
        logger.exception("CSV prediction failed for job %s", job_id)

        previous = _get_csv_progress(job_id)

        _set_csv_progress(
            job_id,
            status="failed",
            processed=previous.get("processed", 0),
            batch=previous.get("batch", 0),
            message="CSV analysis failed. Check the backend terminal.",
        )

        raise HTTPException(
            status_code=500,
            detail=f"CSV prediction failed: {exc}",
        )

    finally:
        await file.close()


# ---------------------------------------------------------
# Analytics endpoints
# ---------------------------------------------------------

@app.get("/analytics")
def analytics():
    return get_dataset_statistics()


@app.get("/model-performance")
def model_performance():
    return get_model_performance()


@app.get("/security-summary")
def security_summary():
    return get_security_summary()


# ---------------------------------------------------------
# Threat history endpoints
# ---------------------------------------------------------

@app.get("/threat-history")
def threat_history(limit: int = Query(500, ge=1, le=5000)):
    return {
        "success": True,
        "statistics": get_threat_statistics(),
        "history": get_threat_history(limit),
    }


@app.delete("/threat-history")
def delete_threat_history():
    clear_history()

    return {
        "success": True,
        "message": "Threat history cleared successfully.",
    }


# ---------------------------------------------------------
# Explainable AI endpoint
# ---------------------------------------------------------

@app.post("/explain-csv")
async def explain_csv(file: UploadFile = File(...)):
    try:
        _validate_csv_name(file)
        features = _required_features()
        header = await _read_header(file)
        _validate_columns(header, features)
        await file.seek(0)

        try:
            df = await run_in_threadpool(
                pd.read_csv,
                file.file,
                nrows=1,
                low_memory=False,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Could not read CSV: {exc}",
            )

        if df.empty:
            raise HTTPException(
                status_code=400,
                detail="The uploaded CSV contains no data rows.",
            )

        df.columns = [str(column).strip() for column in df.columns]

        result = await run_in_threadpool(
            explain_prediction,
            df.iloc[0][features].to_dict(),
        )

        return {
            "success": True,
            "filename": file.filename,
            "total_records_in_file": "at least one",
            "prediction": result["prediction"],
            "confidence": result["confidence"],
            "top_features": result["top_features"],
            "explanation_note": result["explanation_note"],
        }

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Explanation failed")

        raise HTTPException(
            status_code=500,
            detail=f"Explanation failed: {exc}",
        )

    finally:
        await file.close()


# ---------------------------------------------------------
# Model comparison and classification report
# ---------------------------------------------------------

@app.get("/model-comparison")
def model_comparison():
    return get_model_comparison()


@app.get("/classification-report")
def classification_report():
    return get_classification_report()


# ---------------------------------------------------------
# Confusion matrix cache
# ---------------------------------------------------------

def _confusion_cache_signature():
    try:
        stat = DATASET_PATH.stat()

        return {
            "version": CONFUSION_CACHE_VERSION,
            "dataset_path": str(DATASET_PATH.resolve()),
            "dataset_size": stat.st_size,
            "dataset_mtime_ns": stat.st_mtime_ns,
        }

    except OSError:
        return None


def _load_confusion_cache():
    signature = _confusion_cache_signature()

    if signature is None or not CONFUSION_CACHE_FILE.exists():
        return None

    try:
        with CONFUSION_CACHE_FILE.open("r", encoding="utf-8") as cache_file:
            saved = json.load(cache_file)

        if saved.get("signature") != signature:
            return None

        payload = saved.get("payload")

        if not isinstance(payload, dict) or not payload.get("success"):
            return None

        return payload

    except (OSError, ValueError, TypeError):
        logger.warning("Confusion matrix cache could not be read.")
        return None


def _save_confusion_cache(payload):
    signature = _confusion_cache_signature()

    if signature is None:
        return

    temporary_path = None

    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

        saved = {
            "signature": signature,
            "payload": payload,
        }

        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=CACHE_DIR,
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            json.dump(saved, temporary_file)
            temporary_path = Path(temporary_file.name)

        os.replace(temporary_path, CONFUSION_CACHE_FILE)

    except OSError:
        logger.exception("Could not save the confusion matrix cache.")

        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass


# ---------------------------------------------------------
# Confusion matrix calculation
# ---------------------------------------------------------

@lru_cache(maxsize=1)
def _confusion_payload():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Processed dataset not found: {DATASET_PATH}"
        )

    features = _required_features()
    rng = np.random.default_rng(42)
    capacity = 50000
    sample = None
    seen = 0

    for chunk in pd.read_csv(
        DATASET_PATH,
        chunksize=100000,
        low_memory=False,
    ):
        chunk.columns = [str(column).strip() for column in chunk.columns]

        if "Label" not in chunk.columns:
            raise ValueError("Dataset is missing Label column.")

        absent = [
            feature for feature in features
            if feature not in chunk.columns
        ]

        if absent:
            raise ValueError(
                f"Dataset is missing model features: {absent[:10]}"
            )

        chunk = chunk[features + ["Label"]].copy()
        seen += len(chunk)
        chunk["_sample_key"] = rng.random(len(chunk))

        if sample is None:
            sample = chunk
        else:
            sample = pd.concat([sample, chunk], ignore_index=True)

        if len(sample) > capacity:
            sample = (
                sample.nsmallest(capacity, "_sample_key")
                .reset_index(drop=True)
            )

    if sample is None or sample.empty:
        raise ValueError("Dataset contains no rows.")

    sample = sample.drop(columns=["_sample_key"])

    X = (
        sample[features]
        .replace([np.inf, -np.inf], np.nan)
        .apply(pd.to_numeric, errors="coerce")
        .fillna(0)
    )

    y = sample["Label"].astype(str).str.strip()
    stratify = y if y.value_counts().min() >= 2 else None

    _, X_test, _, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=stratify,
    )

    pred, _, _ = predict_batch(X_test)
    pred = np.asarray(pred).astype(str)
    y_test = y_test.astype(str)

    labels = sorted(set(y_test.tolist()) | set(pred.tolist()))

    matrix = sklearn_confusion_matrix(
        y_test,
        pred,
        labels=labels,
    )

    correct = int(np.trace(matrix))
    total = int(matrix.sum())

    return {
        "success": True,
        "model": "XGBoost",
        "class_labels": labels,
        "labels": labels,
        "matrix": matrix.tolist(),
        "confusion_matrix": matrix.tolist(),
        "test_samples": total,
        "correct_predictions": correct,
        "incorrect_predictions": total - correct,
        "accuracy_percent": (
            round(correct / total * 100, 2) if total else 0.0
        ),
        "note": (
            "Evaluation uses a reproducible 20% holdout from a reservoir "
            f"sample of up to {capacity:,} rows drawn across {seen:,} "
            "dataset rows. It is a diagnostic sample, not the original "
            "full training split."
        ),
    }


@app.get("/confusion-matrix")
def confusion_matrix():
    cached = _load_confusion_cache()

    if cached is not None:
        return cached

    try:
        with CONFUSION_CACHE_LOCK:
            cached = _load_confusion_cache()

            if cached is not None:
                return cached

            payload = _confusion_payload()
            _save_confusion_cache(payload)
            return payload

    except Exception as exc:
        logger.exception("Confusion matrix failed")

        return {
            "success": False,
            "error": str(exc),
            "matrix": None,
            "class_labels": None,
            "confusion_matrix": None,
            "labels": None,
        }
