"""
Risk and Severity Engine

Converts:
    Attack Type + ML Confidence
into:
    Risk Score + Severity

Important:
Risk score and severity are application-level security rules.
They are NOT directly learned by the ML model.
"""


# --------------------------------------------------
# BASE RISK BY ATTACK TYPE
# --------------------------------------------------

ATTACK_RISK = {

    # Denial of Service
    "DDoS": 95,
    "DoS Hulk": 90,
    "DoS GoldenEye": 85,
    "DoS slowloris": 80,
    "DoS Slowhttptest": 80,

    # Brute Force
    "FTP-Patator": 75,
    "SSH-Patator": 80,

    # Scanning
    "PortScan": 65,

    # Web Attacks
    "Web Attack � Brute Force": 75,
    "Web Attack � XSS": 70,
    "Web Attack � Sql Injection": 90,

    # Other attacks
    "Bot": 85,
    "Infiltration": 95,
    "Heartbleed": 90,

    # Normal traffic
    "BENIGN": 0
}


# --------------------------------------------------
# SEVERITY CALCULATION
# --------------------------------------------------

def get_severity(risk_score):

    if risk_score >= 80:
        return "CRITICAL"

    elif risk_score >= 60:
        return "HIGH"

    elif risk_score >= 30:
        return "MEDIUM"

    else:
        return "LOW"


# --------------------------------------------------
# RISK CALCULATION
# --------------------------------------------------

def calculate_risk(prediction, confidence):

    prediction = str(prediction).strip()

    confidence = float(confidence)

    # Keep confidence within valid range
    confidence = max(
        0.0,
        min(1.0, confidence)
    )

    # --------------------------------------------------
    # BENIGN TRAFFIC
    # --------------------------------------------------

    if prediction == "BENIGN":

        return {
            "risk_score": 0,
            "severity": "LOW"
        }


    # --------------------------------------------------
    # GET BASE RISK
    # --------------------------------------------------

    base_risk = ATTACK_RISK.get(
        prediction,
        70
    )


    # --------------------------------------------------
    # CONFIDENCE ADJUSTMENT
    # --------------------------------------------------

    # A highly confident prediction keeps
    # almost all of the base risk.

    confidence_factor = (
        0.70 + (0.30 * confidence)
    )


    risk_score = base_risk * confidence_factor


    # --------------------------------------------------
    # ROUND SCORE
    # --------------------------------------------------

    risk_score = round(
        risk_score
    )


    # Keep score between 0 and 100
    risk_score = max(
        0,
        min(100, risk_score)
    )


    # --------------------------------------------------
    # SEVERITY
    # --------------------------------------------------

    severity = get_severity(
        risk_score
    )


    return {
        "risk_score": risk_score,
        "severity": severity
    }


# --------------------------------------------------
# TEST
# --------------------------------------------------

if __name__ == "__main__":

    test_predictions = [

        ("BENIGN", 0.99),
        ("PortScan", 0.99),
        ("SSH-Patator", 0.99),
        ("DDoS", 0.99),
        ("DoS Hulk", 0.99),
        ("Web Attack � XSS", 0.99),
        ("Web Attack � Sql Injection", 0.99),
        ("Infiltration", 0.99)

    ]

    print("\nRisk Engine Test")
    print("=" * 60)

    for prediction, confidence in test_predictions:

        result = calculate_risk(
            prediction,
            confidence
        )

        print(
            f"{prediction:35} "
            f"Risk: {result['risk_score']:3}/100 "
            f"Severity: {result['severity']}"
        )