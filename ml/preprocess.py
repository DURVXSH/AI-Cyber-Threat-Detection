import pandas as pd
import os


# --------------------------------------------------
# 1. Dataset location
# --------------------------------------------------

DATA_DIR = "data/raw/MachineLearningCSV/MachineLearningCVE"

FILES = [
    "Monday-WorkingHours.pcap_ISCX.csv",
    "Tuesday-WorkingHours.pcap_ISCX.csv",
    "Wednesday-workingHours.pcap_ISCX.csv",
    "Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv",
    "Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv",
    "Friday-WorkingHours-Morning.pcap_ISCX.csv",
    "Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv",
    "Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv"
]


# --------------------------------------------------
# 2. Load all CSV files
# --------------------------------------------------

dataframes = []

for file in FILES:

    path = os.path.join(DATA_DIR, file)

    print(f"Loading: {file}")

    df = pd.read_csv(path)

    # Remove spaces from column names
    df.columns = df.columns.str.strip()

    # Remove spaces from labels
    if "Label" in df.columns:
        df["Label"] = df["Label"].astype(str).str.strip()

    dataframes.append(df)


print("\nAll files loaded successfully!")


# --------------------------------------------------
# 3. Combine all files
# --------------------------------------------------

combined_df = pd.concat(dataframes, ignore_index=True)

print("Combined dataset shape:", combined_df.shape)


# --------------------------------------------------
# 4. Remove duplicate network records
# --------------------------------------------------

combined_df = combined_df.drop_duplicates()

print("After removing duplicates:", combined_df.shape)


# --------------------------------------------------
# 5. Handle infinite values
# --------------------------------------------------

combined_df = combined_df.replace([float("inf"), float("-inf")], pd.NA)


# --------------------------------------------------
# 6. Display label distribution
# --------------------------------------------------

print("\nLabel distribution:")

print(combined_df["Label"].value_counts())


# --------------------------------------------------
# 7. Save processed dataset
# --------------------------------------------------

OUTPUT_PATH = "data/processed_cic_ids2017.csv"

combined_df.to_csv(OUTPUT_PATH, index=False)

print(f"\nProcessed dataset saved to: {OUTPUT_PATH}")
print("Preprocessing completed successfully!")