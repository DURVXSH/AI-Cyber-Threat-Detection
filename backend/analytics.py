"""Dataset and dashboard analytics. Values describe the dataset, not live network traffic."""
from functools import lru_cache
from pathlib import Path
import pandas as pd
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_PATH = PROJECT_ROOT / 'data' / 'processed_cic_ids2017.csv'
MODEL_RESULTS_PATH = PROJECT_ROOT / 'models' / 'comparison' / 'model_comparison.csv'

@lru_cache(maxsize=1)
def get_dataset_statistics():
    if not DATASET_PATH.exists():
        return {'success':False,'error':f'Processed dataset not found: {DATASET_PATH}', 'total_events':0,'benign_events':0,'threat_events':0,'benign_percentage':0.0,'threat_percentage':0.0,'attack_types':{},'top_attacks':{}}
    counts = None; total = 0
    for chunk in pd.read_csv(DATASET_PATH, usecols=['Label'], chunksize=100_000, low_memory=False):
        labels = chunk['Label'].astype(str).str.strip()
        part = labels.value_counts()
        counts = part if counts is None else counts.add(part, fill_value=0)
        total += len(chunk)
    if not total or counts is None:
        return {'success':True,'total_events':0,'benign_events':0,'threat_events':0,'benign_percentage':0.0,'threat_percentage':0.0,'attack_types':{},'top_attacks':{}}
    benign = int(counts.get('BENIGN',0)); threats = int(total-benign)
    attacks = {str(k):int(v) for k,v in counts.items() if str(k) != 'BENIGN'}
    top = dict(sorted(attacks.items(), key=lambda item:item[1], reverse=True)[:8])
    return {'success':True,'total_events':int(total),'benign_events':benign,'threat_events':threats,
        'benign_percentage':round(benign/total*100,2),'threat_percentage':round(threats/total*100,2),
        'attack_types':attacks,'top_attacks':top}

@lru_cache(maxsize=1)
def get_model_performance():
    if not MODEL_RESULTS_PATH.exists(): return {'success':False,'error':'Model comparison CSV was not found.'}
    try: df = pd.read_csv(MODEL_RESULTS_PATH)
    except Exception as exc: return {'success':False,'error':str(exc)}
    df.columns = [str(c).strip() for c in df.columns]
    if 'Model' not in df or 'Accuracy' not in df: return {'success':False,'error':'Model or Accuracy column is missing.'}
    match = df[df['Model'].astype(str).str.strip().str.lower() == 'xgboost']
    if match.empty: return {'success':False,'error':'XGBoost metrics were not found in comparison CSV.'}
    row = match.iloc[0]
    def pct(key):
        if key not in row or pd.isna(row[key]): return None
        value = float(row[key]); return round(value*100 if abs(value) <= 1 else value, 2)
    return {'success':True,'model':'XGBoost','accuracy':pct('Accuracy'),'macro_precision':pct('Macro Precision'),
        'macro_recall':pct('Macro Recall'),'macro_f1':pct('Macro F1')}

def get_security_summary():
    stats = get_dataset_statistics()
    if not stats.get('success', True): return {'success':False,'error':stats.get('error','Dataset statistics unavailable')}
    total, threats = stats.get('total_events',0), stats.get('threat_events',0)
    pct = threats/total*100 if total else 0
    status = 'LOW' if pct < 10 else 'MEDIUM' if pct < 25 else 'HIGH' if pct < 50 else 'CRITICAL'
    return {'success':True,'security_status':status,'threat_percentage':round(pct,2),'threat_events':threats,'total_events':total,
            'note':'This status summarizes the CIC-IDS2017 dataset distribution; it is not a live network-wide security assessment.'}
