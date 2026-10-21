"""SHAP explanation helper for the loaded XGBoost classifier."""
import numpy as np
import pandas as pd
from ml.xgboost_predict import load_artifacts, _clean_frame, decode_prediction

def explain_prediction(features, max_features=12):
    model, encoder, columns=load_artifacts()
    frame=_clean_frame(features,columns)
    model_input = frame if getattr(model, 'feature_names_in_', None) is not None else frame.to_numpy()
    raw=model.predict(model_input)[0]
    prediction=decode_prediction(raw,encoder)
    try:
        probabilities=model.predict_proba(model_input)[0]
        confidence=float(np.max(probabilities))
    except Exception: confidence=0.0
    try:
        import shap
        explainer=shap.TreeExplainer(model)
        values=explainer.shap_values(model_input)
        class_index=int(raw) if isinstance(raw,(int,np.integer)) else 0
        if isinstance(values,list):
            values=values[min(class_index,len(values)-1)][0]
        else:
            values=np.asarray(values)
            if values.ndim==3:
                # SHAP versions may return (rows, features, classes).
                values=values[0,:,min(class_index,values.shape[-1]-1)]
            elif values.ndim==2: values=values[0]
            else: values=values.reshape(-1)
        impacts=[]
        for name,value,feature_value in zip(columns,values,frame.iloc[0].to_numpy()):
            impacts.append({'feature':str(name),'shap_value':float(value),'feature_value':float(feature_value),'impact':'increases risk' if value>0 else 'decreases risk' if value<0 else 'neutral'})
        impacts.sort(key=lambda x:abs(x['shap_value']),reverse=True)
        note='SHAP values show feature contributions for this model prediction; they do not prove causation.'
    except Exception as exc:
        impacts=[]
        note=f'SHAP explanation is unavailable for this model/runtime: {exc}. Prediction is still available.'
    return {'prediction':prediction,'confidence':confidence,'top_features':impacts[:max_features],'explanation_note':note}
