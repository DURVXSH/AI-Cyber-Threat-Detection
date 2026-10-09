import pandas as pd
import numpy as np
import joblib
import json
import os
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    ConfusionMatrixDisplay
)


# ==========================================================
# 1. CONFIGURATION
# ==========================================================

DATA_PATH = "data/processed_cic_ids2017.csv"
MODEL_PATH = "models/cyber_threat_model.pkl"
CONFUSION_MATRIX_PATH = "models/confusion_matrix.png"
REPORT_PATH = "models/classification_report.json"

RANDOM_STATE = 42


# Create models directory if it doesn't exist
os.makedirs("models", exist_ok=True)


# ==========================================================
# 2. LOAD DATASET
# ==========================================================

print("\nLoading dataset...")

df = pd.read_csv(DATA_PATH)

print("Dataset loaded successfully!")
print("Dataset shape:", df.shape)


# ==========================================================
# 3. SEPARATE FEATURES AND TARGET
# ==========================================================

X = df.drop("Label", axis=1)
y = df["Label"]

print("\nFeatures shape:", X.shape)
print("Target shape:", y.shape)

print("\nTarget classes:")
print(y.value_counts())


# ==========================================================
# 4. CHECK DATA TYPES
# ==========================================================

non_numeric_columns = X.select_dtypes(
    exclude="number"
).columns.tolist()

print("\nNon-numeric columns:")

if non_numeric_columns:
    print(non_numeric_columns)
else:
    print("None - all features are numeric.")


# ==========================================================
# 5. HANDLE MISSING AND INFINITE VALUES
# ==========================================================

print("\nChecking missing values...")

missing_values = X.isnull().sum()

print(
    "Total missing values:",
    missing_values.sum()
)

if missing_values.sum() > 0:

    print("\nColumns containing missing values:")

    print(
        missing_values[
            missing_values > 0
        ]
    )


# Replace infinite values with NaN
X = X.replace(
    [np.inf, -np.inf],
    np.nan
)


# ==========================================================
# 6. TRAIN / TEST SPLIT
# ==========================================================

print("\nSplitting dataset...")

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=RANDOM_STATE,
    stratify=y
)

print("Training data:", X_train.shape)
print("Testing data:", X_test.shape)


# ==========================================================
# 7. HANDLE MISSING VALUES
# ==========================================================

print("\nHandling missing values...")

# Calculate medians only from training data
train_medians = X_train.median()

X_train = X_train.fillna(train_medians)
X_test = X_test.fillna(train_medians)

print(
    "Missing values in training data:",
    X_train.isnull().sum().sum()
)

print(
    "Missing values in testing data:",
    X_test.isnull().sum().sum()
)


# ==========================================================
# 8. CREATE RANDOM FOREST MODEL
# ==========================================================

print("\nCreating Random Forest model...")

model = RandomForestClassifier(
    n_estimators=100,
    class_weight="balanced",
    random_state=RANDOM_STATE,
    n_jobs=-1
)

print("Random Forest model created!")


# ==========================================================
# 9. TRAIN MODEL
# ==========================================================

print("\nTraining model...")
print("This may take some time because the dataset is large.")

model.fit(
    X_train,
    y_train
)

print("Model training completed!")


# ==========================================================
# 10. MAKE PREDICTIONS
# ==========================================================

print("\nMaking predictions on test data...")

y_pred = model.predict(X_test)

print("Predictions completed!")


# ==========================================================
# 11. MODEL EVALUATION
# ==========================================================

accuracy = accuracy_score(
    y_test,
    y_pred
)

print("\n======================================")
print("MODEL PERFORMANCE")
print("======================================")

print(
    f"\nAccuracy: {accuracy:.4f}"
)

print("\nClassification Report:")

classification_report_text = classification_report(
    y_test,
    y_pred
)

print(classification_report_text)


# ==========================================================
# 12. SAVE TRAINED MODEL
# ==========================================================

print("\nSaving trained model...")

joblib.dump(
    model,
    MODEL_PATH
)

print(
    f"Model saved to: {MODEL_PATH}"
)


# ==========================================================
# 13. SAVE CONFUSION MATRIX
# ==========================================================

print("\nGenerating confusion matrix...")

ConfusionMatrixDisplay.from_predictions(
    y_test,
    y_pred,
    xticks_rotation="vertical"
)

plt.title(
    "AI Cyber Threat Detection - Confusion Matrix"
)

plt.tight_layout()

plt.savefig(
    CONFUSION_MATRIX_PATH,
    dpi=150
)

plt.close()

print(
    f"Confusion matrix saved to: "
    f"{CONFUSION_MATRIX_PATH}"
)


# ==========================================================
# 14. SAVE CLASSIFICATION REPORT
# ==========================================================

report = classification_report(
    y_test,
    y_pred,
    output_dict=True
)

with open(
    REPORT_PATH,
    "w"
) as file:

    json.dump(
        report,
        file,
        indent=4
    )

print(
    f"Classification report saved to: "
    f"{REPORT_PATH}"
)


# ==========================================================
# 15. FINAL SUMMARY
# ==========================================================

print("\n======================================")
print("TRAINING PIPELINE COMPLETED")
print("======================================")

print(f"Accuracy: {accuracy:.4%}")
print(f"Model: {MODEL_PATH}")
print(f"Report: {REPORT_PATH}")
print(f"Confusion Matrix: {CONFUSION_MATRIX_PATH}")