"""SQLite persistence for detection history."""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATABASE_PATH = PROJECT_ROOT / 'backend' / 'threat_history.db'

def get_connection():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DATABASE_PATH), timeout=30)
    conn.row_factory = sqlite3.Row
    return conn

def initialize_database():
    with get_connection() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS threat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            prediction TEXT NOT NULL,
            confidence REAL NOT NULL,
            risk_score INTEGER NOT NULL,
            severity TEXT NOT NULL,
            source TEXT DEFAULT 'Single Detection'
        )""")
        conn.execute('CREATE INDEX IF NOT EXISTS idx_threat_history_timestamp ON threat_history(timestamp)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_threat_history_prediction ON threat_history(prediction)')

def save_threats(threats):
    if not threats: return
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')
    rows = [(now, str(t['prediction']), float(t.get('confidence', 0)), int(t.get('risk_score', 0)),
             str(t.get('severity', 'LOW')), str(t.get('source', 'Single Detection'))) for t in threats]
    with get_connection() as conn:
        conn.executemany("""INSERT INTO threat_history
            (timestamp,prediction,confidence,risk_score,severity,source) VALUES (?,?,?,?,?,?)""", rows)

def save_threat(prediction, confidence, risk_score, severity, source='Single Detection'):
    save_threats([{'prediction':prediction,'confidence':confidence,'risk_score':risk_score,'severity':severity,'source':source}])

def get_threat_history(limit=500):
    limit = max(1, min(int(limit), 5000))
    with get_connection() as conn:
        rows = conn.execute('SELECT * FROM threat_history ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
    return [dict(row) for row in rows]

def get_threat_statistics():
    with get_connection() as conn:
        row = conn.execute("""SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN UPPER(prediction) != 'BENIGN' THEN 1 ELSE 0 END),0) AS threats,
            COALESCE(SUM(CASE WHEN UPPER(prediction) = 'BENIGN' THEN 1 ELSE 0 END),0) AS benign,
            COALESCE(SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END),0) AS critical
            FROM threat_history""").fetchone()
    return {k:int(row[k] or 0) for k in ('total','threats','benign','critical')}

def clear_history():
    with get_connection() as conn: conn.execute('DELETE FROM threat_history')
