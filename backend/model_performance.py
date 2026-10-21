"""Read persisted model comparison metrics and classification reports."""
from pathlib import Path
import json
import pandas as pd
PROJECT_ROOT = Path(__file__).resolve().parent.parent
COMPARISON_PATH = PROJECT_ROOT/'models'/'comparison'/'model_comparison.csv'
REPORT_CANDIDATES = [PROJECT_ROOT/'models'/'comparison'/'xgboost_report.json', PROJECT_ROOT/'models'/'classification_report.json']

def _percent(value):
    if pd.isna(value): return None
    number=float(value)
    return round(number*100 if abs(number)<=1 else number, 3)

def get_model_comparison():
    if not COMPARISON_PATH.exists(): return {'success':False,'error':'Model comparison CSV was not found. Train the comparison models first.','models':[],'best_model':None}
    try: df=pd.read_csv(COMPARISON_PATH)
    except Exception as exc: return {'success':False,'error':f'Unable to read model comparison CSV: {exc}','models':[],'best_model':None}
    df.columns=[str(c).strip() for c in df.columns]
    required=['Model','Accuracy','Macro Precision','Macro Recall','Macro F1']
    missing=[c for c in required if c not in df.columns]
    if missing: return {'success':False,'error':f'Missing columns in comparison CSV: {missing}','models':[],'best_model':None}
    models=[]
    for _,r in df.iterrows():
        name=str(r.get('Model','')).strip()
        if not name or name.lower()=='nan': continue
        def val(key):
            try: return float(r[key]) if key in r and pd.notna(r[key]) else None
            except (TypeError,ValueError): return None
        accuracy=_percent(val('Accuracy')) if val('Accuracy') is not None else None
        macro_f1=_percent(val('Macro F1')) if val('Macro F1') is not None else None
        if accuracy is None or macro_f1 is None: continue
        models.append({'model':name,'accuracy':accuracy,
            'macro_precision':_percent(val('Macro Precision')) if val('Macro Precision') is not None else None,
            'macro_recall':_percent(val('Macro Recall')) if val('Macro Recall') is not None else None,
            'macro_f1':macro_f1,
            'weighted_f1':_percent(val('Weighted F1')) if val('Weighted F1') is not None else None,
            'training_time_seconds':round(val('Training Time (sec)'),2) if val('Training Time (sec)') is not None else None,
            'prediction_time_seconds':round(val('Prediction Time (sec)'),4) if val('Prediction Time (sec)') is not None else None})
    models.sort(key=lambda x:x['macro_f1'] if x['macro_f1'] is not None else -1, reverse=True)
    return {'success':True,'models':models,'best_model':models[0] if models else None,
        'metric_note':'Metrics are read from the saved benchmark CSV. Percentages are normalized automatically; timings reflect the machine and test split used during training.'}

def get_classification_report():
    path=next((p for p in REPORT_CANDIDATES if p.exists()),None)
    if path is None: return {'success':False,'error':'No classification report JSON was found. Train a model first.'}
    try:
        with path.open('r',encoding='utf-8') as f: report=json.load(f)
        return {'success':True,'report':report,'source_file':str(path.relative_to(PROJECT_ROOT))}
    except (OSError,json.JSONDecodeError) as exc: return {'success':False,'error':str(exc)}
