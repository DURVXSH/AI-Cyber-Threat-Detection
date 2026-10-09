import pandas as pd
import json
import os

DATASET_PATH = "data/processed_cic_ids2017.csv"
MODEL_RESULTS_PATH = "models/comparison/model_comparison.csv"


def get_dataset_statistics():

    df = pd.read_csv(DATASET_PATH)

    total_events = len(df)

    label_counts = df["Label"].value_counts()

    benign_events = int(label_counts.get("BENIGN", 0))

    threat_events = total_events - benign_events

    attack_types = {
        str(label): int(count)
        for label, count in label_counts.items()
        if label != "BENIGN"
    }

    # Top 5 attacks
    top_attacks = dict(
        sorted(
            attack_types.items(),
            key=lambda item: item[1],
            reverse=True
        )[:5]
    )

    # Traffic percentages
    benign_percentage = round(
        (benign_events / total_events) * 100,
        2
    )

    threat_percentage = round(
        (threat_events / total_events) * 100,
        2
    )

    return {
        "total_events": int(total_events),
        "benign_events": benign_events,
        "threat_events": int(threat_events),

        "benign_percentage": benign_percentage,
        "threat_percentage": threat_percentage,

        "attack_types": attack_types,
        "top_attacks": top_attacks
    }


def get_model_performance():

    if not os.path.exists(MODEL_RESULTS_PATH):
        return {}

    df = pd.read_csv(MODEL_RESULTS_PATH)

    # Find XGBoost row
    xgboost_row = df[
        df["Model"].str.lower() == "xgboost"
    ]

    if xgboost_row.empty:
        return {}

    row = xgboost_row.iloc[0]

    return {
        "model": "XGBoost",

        "accuracy": round(
            float(row["Accuracy"]) * 100,
            2
        ),

        "macro_precision": round(
            float(row["Macro Precision"]) * 100,
            2
        ),

        "macro_recall": round(
            float(row["Macro Recall"]) * 100,
            2
        ),

        "macro_f1": round(
            float(row["Macro F1"]) * 100,
            2
        )
    }


def get_security_summary():

    statistics = get_dataset_statistics()

    total = statistics["total_events"]
    threats = statistics["threat_events"]

    threat_percentage = (
        threats / total
    ) * 100

    if threat_percentage < 10:
        security_status = "LOW"
    elif threat_percentage < 25:
        security_status = "MEDIUM"
    elif threat_percentage < 50:
        security_status = "HIGH"
    else:
        security_status = "CRITICAL"

    return {
        "security_status": security_status,
        "threat_percentage": round(threat_percentage, 2),
        "threat_events": threats,
        "total_events": total
    }