"""Application-level risk scoring for predicted CIC-IDS2017 traffic labels."""
import re

ATTACK_RISK = {
    "DDoS": 95, "DoS Hulk": 90, "DoS GoldenEye": 85,
    "DoS slowloris": 80, "DoS Slowhttptest": 80,
    "FTP-Patator": 75, "SSH-Patator": 80, "PortScan": 65,
    "Web Attack – Brute Force": 75, "Web Attack - Brute Force": 75,
    "Web Attack � Brute Force": 75, "Web Attack – XSS": 70,
    "Web Attack - XSS": 70, "Web Attack � XSS": 70,
    "Web Attack – Sql Injection": 90, "Web Attack - Sql Injection": 90,
    "Web Attack � Sql Injection": 90, "Bot": 85, "Infiltration": 95,
    "Heartbleed": 90, "BENIGN": 0,
}

def normalize_label(label):
    value = str(label).strip()
    value = value.replace('–', '-').replace('—', '-')
    value = re.sub(r'\s+', ' ', value)
    # CIC-IDS2017 web attack labels are sometimes decoded with replacement characters.
    if value.lower().startswith('web attack'):
        tail = value.lower()
        if 'brute' in tail: return 'Web Attack - Brute Force'
        if 'xss' in tail: return 'Web Attack - XSS'
        if 'sql' in tail or 'injection' in tail: return 'Web Attack - Sql Injection'
    return value

def get_severity(risk_score):
    score = float(risk_score)
    if score >= 80: return 'CRITICAL'
    if score >= 60: return 'HIGH'
    if score >= 30: return 'MEDIUM'
    return 'LOW'

def calculate_risk(prediction, confidence):
    label = normalize_label(prediction)
    try: conf = float(confidence)
    except (TypeError, ValueError): conf = 0.0
    if not (conf == conf): conf = 0.0
    conf = max(0.0, min(1.0, conf))
    if label.upper() == 'BENIGN': return {'risk_score': 0, 'severity': 'LOW'}
    base = ATTACK_RISK.get(label, 70)
    score = max(0, min(100, round(base * (0.70 + 0.30 * conf))))
    return {'risk_score': int(score), 'severity': get_severity(score)}
