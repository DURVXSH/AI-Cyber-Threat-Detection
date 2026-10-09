# 🛡️ AI Cyber Threat Detection Platform

An AI-powered network threat detection platform that analyzes network traffic data, identifies potentially malicious activity, and presents security insights through an interactive dashboard.

Built using **Python, XGBoost, FastAPI, React, and Explainable AI**, this project demonstrates an end-to-end machine learning workflow for network intrusion detection.

## 🚀 Features

- **AI-Based Threat Detection:** Classifies network traffic as benign or potentially malicious using a trained XGBoost model.
- **CSV Batch Analysis:** Upload network traffic CSV files and analyze multiple records.
- **Interactive Security Dashboard:** View threat statistics, attack categories, and severity summaries.
- **Explainable AI:** Inspect feature contributions to understand why a prediction was made.
- **Threat History:** Store and review detected threats using SQLite.
- **Model Evaluation:** Explore the confusion matrix, classification report, and model comparison results.
- **Dataset Analytics:** Review key patterns and statistics from the network traffic data.
- **REST API:** Access prediction and analytics functionality through FastAPI.

## 🧰 Tech Stack

| Area | Technologies |
|---|---|
| Machine Learning | Python, XGBoost, scikit-learn |
| Explainable AI | SHAP |
| Backend | FastAPI, Uvicorn |
| Frontend | React, Vite, JavaScript |
| Data Processing | Pandas, NumPy |
| Visualization | Recharts, Matplotlib |
| Database | SQLite |
| Dataset | CIC-IDS2017 |

## 🏗️ Architecture

1. **Input:** Network traffic records are provided as a CSV file.
2. **Preprocessing:** Data is validated and prepared to match the model's expected features.
3. **Prediction:** The trained XGBoost model predicts whether records are benign or potentially malicious.
4. **Risk Analysis:** Predictions are summarized by threat category and severity.
5. **Explainability:** Feature contributions help users inspect individual predictions.
6. **Visualization:** The React dashboard presents detection results and model evaluation metrics.
7. **History:** Threat records are stored locally in SQLite for later review.

## 📂 Project Structure

```text
AI-Cyber-Threat-Detection/
├── backend/
│   ├── analytics.py
│   ├── database.py
│   ├── main.py
│   ├── model_performance.py
│   └── risk_engine.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── ml/
│   ├── explain_prediction.py
│   ├── model_comparison.py
│   ├── preprocess.py
│   ├── train_model.py
│   └── xgboost_predict.py
├── models/
│   ├── cyber_threat_model.pkl
│   ├── classification_report.json
│   └── comparison/
├── .gitattributes
├── .gitignore
└── README.md
```

## ⚙️ Getting Started

### Prerequisites

- Python 3.10 or a compatible version for the installed dependencies
- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/DURVXSH/AI-Cyber-Threat-Detection.git
cd AI-Cyber-Threat-Detection
```

Because the trained model is stored with Git LFS, install Git LFS before cloning if necessary. After cloning, verify that `models/cyber_threat_model.pkl` is the actual model file and not an LFS pointer.

### 2. Set up the Python environment

```bash
python -m venv venv
```

Activate it on Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Install the Python dependencies:

```bash
pip install -r requirements.txt
```

### 3. Start the backend

From the project root, run:

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

The API should be available at:

- API: http://127.0.0.1:8000
- Interactive API documentation: http://127.0.0.1:8000/docs

### 4. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173.

## 📊 Model Evaluation

The project includes a classification report, confusion matrix, and model comparison artifacts generated during model evaluation.

Evaluation results depend on the dataset, preprocessing, and test split. Consult the included report files for the actual measured metrics.

## 🔍 Explainable AI

The explainability feature helps investigate which input features contributed to a prediction. This supports model interpretation and debugging; it does not guarantee that a prediction is correct or establish the cause of an attack.

## 📁 Dataset

The model was developed using the **CIC-IDS2017** network intrusion detection dataset.

The raw and processed dataset files are not included in this repository because of their size. Obtain the dataset from its official source and follow its usage terms if you want to reproduce the preprocessing or training workflow.

## ⚠️ Limitations

- Predictions depend on the quality and compatibility of the input data.
- Performance on CIC-IDS2017 does not guarantee performance on live or unseen network traffic.
- This is a portfolio and learning project, not a substitute for a production-grade security monitoring system.
- Model outputs should be validated before being used to make operational security decisions.

## 🔮 Future Improvements

- Real-time network traffic ingestion
- Model monitoring and drift detection
- Authentication and role-based access control
- Automated deployment with Docker
- Expanded testing and security hardening

## 👨‍💻 Author

**Durvesh Shelar**

- GitHub: [@DURVXSH](https://github.com/DURVXSH)

---

If you find this project useful, feel free to explore the code and share feedback.