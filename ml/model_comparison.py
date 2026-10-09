import os
import time
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline

from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report
)

from xgboost import XGBClassifier
from lightgbm import LGBMClassifier


# ============================================================
# SETTINGS
# ============================================================

DATA_PATH = "data/processed_cic_ids2017.csv"
RESULTS_DIR = "models/comparison"

RANDOM_STATE = 42
TEST_SIZE = 0.20

os.makedirs(RESULTS_DIR, exist_ok=True)


# ============================================================
# START
# ============================================================

print("\n==========================================")
print("AI CYBER THREAT DETECTION")
print("FULL DATASET MODEL COMPARISON")
print("==========================================")


# ============================================================
# 1. LOAD DATASET
# ============================================================

print("\nLoading complete dataset...")

df = pd.read_csv(DATA_PATH)

print("Dataset loaded successfully.")
print("Dataset shape:", df.shape)


# ============================================================
# 2. CLEAN DATA
# ============================================================

print("\nCleaning dataset...")

# Remove spaces from column names
df.columns = df.columns.str.strip()

# Clean label column
df["Label"] = df["Label"].astype(str).str.strip()

# Replace infinity values with NaN
df = df.replace([np.inf, -np.inf], np.nan)

# Remove duplicate rows
df = df.drop_duplicates()

print("Dataset after cleaning:", df.shape)


# ============================================================
# 3. SEPARATE FEATURES AND TARGET
# ============================================================

print("\nSeparating features and target...")

X = df.drop("Label", axis=1)
y = df["Label"]

print("Number of features:", X.shape[1])
print("Number of records:", X.shape[0])


# ============================================================
# 4. MAKE ALL FEATURES NUMERIC
# ============================================================

print("\nConverting features to numeric...")

for column in X.columns:
    X[column] = pd.to_numeric(X[column], errors="coerce")

print("All features converted to numeric.")


# ============================================================
# 5. ENCODE TARGET LABELS
# ============================================================

print("\nEncoding attack labels...")

label_encoder = LabelEncoder()

y_encoded = label_encoder.fit_transform(y)

print("Number of classes:", len(label_encoder.classes_))

print("\nClasses:")

for index, label in enumerate(label_encoder.classes_):
    print(index, "=", label)


# Save label encoder
joblib.dump(
    label_encoder,
    f"{RESULTS_DIR}/label_encoder.pkl"
)


# ============================================================
# 6. TRAIN / TEST SPLIT
# ============================================================

print("\nSplitting dataset...")

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y_encoded,
    test_size=TEST_SIZE,
    random_state=RANDOM_STATE,
    stratify=y_encoded
)

print("Training records:", len(X_train))
print("Testing records:", len(X_test))


# ============================================================
# 7. HANDLE MISSING VALUES
# ============================================================

print("\nHandling missing values...")

imputer = SimpleImputer(strategy="median")

X_train = pd.DataFrame(
    imputer.fit_transform(X_train),
    columns=X_train.columns,
    index=X_train.index
)

X_test = pd.DataFrame(
    imputer.transform(X_test),
    columns=X_test.columns,
    index=X_test.index
)

print("Missing values handled successfully.")


# ============================================================
# 8. DEFINE MACHINE LEARNING MODELS
# ============================================================

print("\nPreparing machine learning models...")

models = {

    "Decision Tree": DecisionTreeClassifier(
        random_state=RANDOM_STATE,
        class_weight="balanced",
        max_depth=30
    ),

    "Random Forest": RandomForestClassifier(
        n_estimators=100,
        random_state=RANDOM_STATE,
        class_weight="balanced",
        n_jobs=-1
    ),

    "Logistic Regression": Pipeline([
        (
            "scaler",
            StandardScaler()
        ),

        (
            "classifier",
            LogisticRegression(
                max_iter=200,
                class_weight="balanced",
                solver="lbfgs"
            )
        )
    ]),

    "XGBoost": XGBClassifier(
        n_estimators=100,
        max_depth=8,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="multi:softprob",
        eval_metric="mlogloss",
        random_state=RANDOM_STATE,
        n_jobs=-1
    ),

    "LightGBM": LGBMClassifier(
        n_estimators=100,
        learning_rate=0.1,
        num_leaves=31,
        max_depth=-1,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=-1,
        verbosity=-1
    )
}


# ============================================================
# 9. TRAIN AND EVALUATE EACH MODEL
# ============================================================

results = []

trained_models = {}


for model_name, model in models.items():

    print("\n")
    print("==========================================")
    print(f"TRAINING: {model_name}")
    print("==========================================")

    # --------------------------------------------------------
    # TRAIN MODEL
    # --------------------------------------------------------

    print("\nTraining model...")

    start_training = time.time()

    model.fit(
        X_train,
        y_train
    )

    training_time = time.time() - start_training

    print(
        f"Training completed in {training_time:.2f} seconds."
    )


    # --------------------------------------------------------
    # MAKE PREDICTIONS
    # --------------------------------------------------------

    print("\nMaking predictions...")

    start_prediction = time.time()

    y_pred = model.predict(X_test)

    prediction_time = time.time() - start_prediction

    print(
        f"Prediction completed in {prediction_time:.2f} seconds."
    )


    # --------------------------------------------------------
    # CALCULATE METRICS
    # --------------------------------------------------------

    accuracy = accuracy_score(
        y_test,
        y_pred
    )

    precision = precision_score(
        y_test,
        y_pred,
        average="macro",
        zero_division=0
    )

    recall = recall_score(
        y_test,
        y_pred,
        average="macro",
        zero_division=0
    )

    macro_f1 = f1_score(
        y_test,
        y_pred,
        average="macro",
        zero_division=0
    )

    weighted_f1 = f1_score(
        y_test,
        y_pred,
        average="weighted",
        zero_division=0
    )


    # --------------------------------------------------------
    # DISPLAY RESULTS
    # --------------------------------------------------------

    print("\nPerformance:")

    print(
        f"Accuracy:        {accuracy:.4f}"
    )

    print(
        f"Macro Precision:  {precision:.4f}"
    )

    print(
        f"Macro Recall:     {recall:.4f}"
    )

    print(
        f"Macro F1:         {macro_f1:.4f}"
    )

    print(
        f"Weighted F1:      {weighted_f1:.4f}"
    )


    # --------------------------------------------------------
    # SAVE MODEL
    # --------------------------------------------------------

    safe_name = (
        model_name
        .lower()
        .replace(" ", "_")
    )

    model_path = (
        f"{RESULTS_DIR}/{safe_name}.pkl"
    )

    joblib.dump(
        model,
        model_path
    )

    print(
        f"\nModel saved to: {model_path}"
    )


    # --------------------------------------------------------
    # CLASSIFICATION REPORT
    # --------------------------------------------------------

    report = classification_report(
        y_test,
        y_pred,
        labels=np.arange(len(label_encoder.classes_)),
        target_names=label_encoder.classes_,
        output_dict=True,
        zero_division=0
    )

    report_path = (
        f"{RESULTS_DIR}/{safe_name}_report.json"
    )

    with open(
        report_path,
        "w"
    ) as file:

        json.dump(
            report,
            file,
            indent=4
        )

    print(
        f"Classification report saved to: {report_path}"
    )


    # --------------------------------------------------------
    # STORE RESULTS
    # --------------------------------------------------------

    results.append({

        "Model": model_name,

        "Accuracy": accuracy,

        "Macro Precision": precision,

        "Macro Recall": recall,

        "Macro F1": macro_f1,

        "Weighted F1": weighted_f1,

        "Training Time (sec)": training_time,

        "Prediction Time (sec)": prediction_time
    })


    trained_models[model_name] = model


# ============================================================
# 10. CREATE MODEL COMPARISON TABLE
# ============================================================

results_df = pd.DataFrame(
    results
)


# Sort primarily by Macro F1
results_df = results_df.sort_values(
    by="Macro F1",
    ascending=False
)


print("\n\n==========================================")
print("FINAL MODEL COMPARISON")
print("==========================================")

print(
    results_df.to_string(
        index=False
    )
)


# ============================================================
# 11. SAVE COMPARISON TABLE
# ============================================================

comparison_path = (
    f"{RESULTS_DIR}/model_comparison.csv"
)

results_df.to_csv(
    comparison_path,
    index=False
)

print(
    f"\nComparison saved to: {comparison_path}"
)


# ============================================================
# 12. SELECT BEST MODEL
# ============================================================

best_model_name = (
    results_df.iloc[0]["Model"]
)

best_model = (
    trained_models[best_model_name]
)


best_model_path = (
    f"{RESULTS_DIR}/best_model.pkl"
)

joblib.dump(
    best_model,
    best_model_path
)


print("\n==========================================")
print("BEST MODEL")
print("==========================================")

print(
    f"Best model: {best_model_name}"
)

print(
    f"Macro F1: "
    f"{results_df.iloc[0]['Macro F1']:.4f}"
)

print(
    f"Accuracy: "
    f"{results_df.iloc[0]['Accuracy']:.4f}"
)

print(
    f"Saved to: {best_model_path}"
)


# ============================================================
# 13. CREATE COMPARISON CHART
# ============================================================

print("\nCreating comparison chart...")

plt.figure(
    figsize=(12, 7)
)

plt.bar(
    results_df["Model"],
    results_df["Macro F1"]
)

plt.xlabel(
    "Machine Learning Model"
)

plt.ylabel(
    "Macro F1 Score"
)

plt.title(
    "AI Cyber Threat Detection - Model Comparison"
)

plt.xticks(
    rotation=25,
    ha="right"
)

plt.ylim(
    0,
    1
)

plt.tight_layout()


chart_path = (
    f"{RESULTS_DIR}/model_comparison.png"
)

plt.savefig(
    chart_path,
    dpi=150
)

plt.close()


print(
    f"Comparison chart saved to: {chart_path}"
)


# ============================================================
# 14. SAVE SUMMARY
# ============================================================

summary = {

    "dataset": "CIC-IDS2017",

    "records": int(len(df)),

    "features": int(X.shape[1]),

    "classes": int(len(label_encoder.classes_)),

    "test_size": TEST_SIZE,

    "best_model": best_model_name,

    "best_macro_f1":
        float(results_df.iloc[0]["Macro F1"]),

    "best_accuracy":
        float(results_df.iloc[0]["Accuracy"]),

    "models_compared":
        list(models.keys())
}


summary_path = (
    f"{RESULTS_DIR}/summary.json"
)

with open(
    summary_path,
    "w"
) as file:

    json.dump(
        summary,
        file,
        indent=4
    )


# ============================================================
# FINISHED
# ============================================================

print("\n==========================================")
print("MODEL COMPARISON COMPLETED")
print("==========================================")

print(
    "\nAll five models were trained on the "
    "complete CIC-IDS2017 dataset."
)

print(
    "The best model was selected using Macro F1."
)

print(
    "\nNext step: analyze the model comparison "
    "and choose the final production model."
)