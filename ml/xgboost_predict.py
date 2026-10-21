"""Safe XGBoost inference loader. Model artifacts remain in models/comparison."""
from functools import lru_cache
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
PROJECT_ROOT=Path(__file__).resolve().parent.parent
MODEL_PATH=PROJECT_ROOT/'models'/'comparison'/'xgboost.pkl'
LABEL_ENCODER_PATH=PROJECT_ROOT/'models'/'comparison'/'label_encoder.pkl'
DATASET_PATH=PROJECT_ROOT/'data'/'processed_cic_ids2017.csv'

@lru_cache(maxsize=1)
def load_artifacts():
    if not MODEL_PATH.exists(): raise FileNotFoundError(f'XGBoost model not found: {MODEL_PATH}. Run the model comparison training script first.')
    if not LABEL_ENCODER_PATH.exists(): raise FileNotFoundError(f'Label encoder not found: {LABEL_ENCODER_PATH}.')
    model=joblib.load(MODEL_PATH); encoder=joblib.load(LABEL_ENCODER_PATH)
    columns=getattr(model,'feature_names_in_',None)
    if columns is None:
        if not DATASET_PATH.exists(): raise FileNotFoundError(f'Cannot infer model feature order because dataset is missing: {DATASET_PATH}')
        columns=[c for c in pd.read_csv(DATASET_PATH,nrows=0).columns if str(c).strip()!='Label']
    columns=[str(c).strip() for c in columns]
    expected=getattr(model,'n_features_in_',None)
    if expected is not None and len(columns)!=int(expected): raise ValueError(f'Model expects {expected} features but inferred {len(columns)} columns. Verify training schema.')
    return model,encoder,columns

def get_model(): return load_artifacts()[0]
def get_label_encoder(): return load_artifacts()[1]
def get_feature_columns(): return load_artifacts()[2]

def _clean_frame(features, columns=None):
    model, encoder, inferred=load_artifacts(); columns=columns or inferred
    if isinstance(features,pd.DataFrame): frame=features.copy()
    elif isinstance(features,dict): frame=pd.DataFrame([features])
    else: frame=pd.DataFrame(features)
    frame.columns=[str(c).strip() for c in frame.columns]
    frame=frame.reindex(columns=columns)
    frame=frame.replace([np.inf,-np.inf],np.nan)
    frame=frame.apply(pd.to_numeric,errors='coerce').fillna(0)
    return frame

def decode_prediction(value, encoder=None):
    encoder=encoder or get_label_encoder()
    if isinstance(value,(int,np.integer)) or (isinstance(value,(float,np.floating)) and float(value).is_integer()):
        number=int(value)
        if 0 <= number < len(encoder.classes_): return str(encoder.inverse_transform([number])[0])
    return str(value)

def predict_batch(features):
    model,encoder,columns=load_artifacts()
    frame=_clean_frame(features,columns)
    model_input = frame if getattr(model, 'feature_names_in_', None) is not None else frame.to_numpy()
    raw=model.predict(model_input)
    labels=[decode_prediction(v,encoder) for v in raw]
    try:
        probs=model.predict_proba(model_input)
        confidence=np.max(probs,axis=1).astype(float)
    except Exception:
        confidence=np.full(len(frame),np.nan,dtype=float)
    return labels,confidence,frame

def predict_threat(features):
    labels,confidence,_=predict_batch(features)
    from backend.risk_engine import calculate_risk
    conf=float(confidence[0]) if len(confidence) and np.isfinite(confidence[0]) else 0.0
    risk=calculate_risk(labels[0],conf)
    return {'prediction':labels[0],'confidence':conf,'risk_score':risk['risk_score'],'severity':risk['severity']}

# Backwards-compatible module attributes for existing imports.
class _LazyAttribute:
    def __getattr__(self,name): return getattr(get_model(),name)
try:
    model, label_encoder, FEATURE_COLUMNS = load_artifacts()
except Exception:
    # Keep API importable when artifacts have not yet been trained/copied.
    model = label_encoder = None
    FEATURE_COLUMNS = []
