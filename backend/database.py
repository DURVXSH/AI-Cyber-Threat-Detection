import sqlite3
from datetime import datetime

DATABASE_PATH = "backend/threat_history.db"


def get_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_database():
    conn = get_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS threat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            prediction TEXT NOT NULL,
            confidence REAL NOT NULL,
            risk_score INTEGER NOT NULL,
            severity TEXT NOT NULL,
            source TEXT DEFAULT 'Single Detection'
        )
    """)

    conn.commit()
    conn.close()


def save_threat(
    prediction,
    confidence,
    risk_score,
    severity,
    source="Single Detection"
):
    conn = get_connection()

    conn.execute("""
        INSERT INTO threat_history
        (timestamp, prediction, confidence, risk_score, severity, source)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        datetime.now().isoformat(),
        prediction,
        confidence,
        risk_score,
        severity,
        source
    ))

    conn.commit()
    conn.close()


def get_threat_history(limit=500):
    conn = get_connection()

    rows = conn.execute("""
        SELECT *
        FROM threat_history
        ORDER BY id DESC
        LIMIT ?
    """, (limit,)).fetchall()

    conn.close()

    return [dict(row) for row in rows]


def get_threat_statistics():
    conn = get_connection()

    total = conn.execute(
        "SELECT COUNT(*) FROM threat_history"
    ).fetchone()[0]

    threats = conn.execute("""
        SELECT COUNT(*)
        FROM threat_history
        WHERE prediction != 'BENIGN'
    """).fetchone()[0]

    benign = conn.execute("""
        SELECT COUNT(*)
        FROM threat_history
        WHERE prediction = 'BENIGN'
    """).fetchone()[0]

    conn.close()

    return {
        "total": total,
        "threats": threats,
        "benign": benign
    }


def clear_history():
    conn = get_connection()

    conn.execute("DELETE FROM threat_history")

    conn.commit()
    conn.close()