
import { useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function Explainability() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleExplain() {
    if (!file) {
      setError("Choose a CIC-IDS2017-compatible CSV first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/explain-csv`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Explanation failed.");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Could not connect to the backend.");
    } finally {
      setLoading(false);
    }
  }

  function confidenceLabel(value) {
    return `${(value * 100).toFixed(2)}%`;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-blue-400">
            EXPLAINABLE ARTIFICIAL INTELLIGENCE
          </p>

          <h1 className="text-3xl font-bold">
            AI Prediction Explainer
          </h1>

          <p className="mt-2 text-slate-400">
            Understand which network traffic features influenced
            the XGBoost model's prediction.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">
            Analyze a network traffic record
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Upload a CSV containing all required CIC-IDS2017
            model features. The first data row will be explained.
          </p>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setResult(null);
                setError("");
              }}
              className="block w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:font-medium file:text-white"
            />

            <button
              onClick={handleExplain}
              disabled={!file || loading}
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Analyzing..." : "Explain Prediction"}
            </button>
          </div>

          {file && (
            <p className="mt-3 text-sm text-slate-400">
              Selected file: {file.name}
            </p>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}
        </section>

        {loading && (
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="font-medium">Calculating SHAP values...</p>
            <p className="mt-2 text-sm text-slate-400">
              The first explanation may take a little time.
            </p>
          </div>
        )}

        {result && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <p className="text-sm text-slate-400">
                  Predicted Attack Class
                </p>
                <p
                    style={{ overflowWrap: "anywhere" }}
                    className="mt-2 text-2xl font-bold text-blue-400"
                    >
                    {result.prediction}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <p className="text-sm text-slate-400">
                  Model Confidence
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {confidenceLabel(result.confidence)}
                </p>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">
                  Why did the model make this prediction?
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Features are ranked by the absolute size of their
                  SHAP contribution for the predicted class.
                </p>
              </div>

              <div className="space-y-6">
                {result.top_features.map((item, index) => {
                  const maxMagnitude = Math.max(
                    ...result.top_features.map((feature) =>
                      Math.abs(feature.shap_value)
                    ),
                    0.000001
                  );

                  const width =
                    (Math.abs(item.shap_value) / maxMagnitude) * 100;

                  const supports = item.shap_value > 0;

                  return (
                    <div key={item.feature}>
                      <div className="mb-2 flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="text-xs text-slate-500">
                            {index + 1}.
                          </span>
                          <span className="break-all text-sm font-medium">
                            {item.feature}
                          </span>
                        </div>

                        <span
                          className={`text-sm font-semibold ${
                            supports ? "text-red-400" : "text-blue-400"
                          }`}
                        >
                          {item.shap_value > 0 ? "+" : ""}
                          {item.shap_value.toExponential(3)}
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            supports ? "bg-red-400" : "bg-blue-400"
                          }`}
                          style={{ width: `${width}%` }}
                        />
                      </div>

                      <div className="mt-1 flex flex-col justify-between gap-1 text-xs text-slate-500 sm:flex-row">
                        <span>
                          Feature value:{" "}
                          {item.value === null
                            ? "N/A"
                            : Number(item.value).toLocaleString(
                                undefined,
                                { maximumFractionDigits: 4 }
                              )}
                        </span>

                        <span>
                          {supports
                            ? "Supports predicted class"
                            : item.shap_value < 0
                              ? "Opposes predicted class"
                              : "No contribution"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 rounded-lg border border-slate-700 bg-slate-800/60 p-4">
                <h3 className="font-medium">How to read this</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {result.explanation_note}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Red bars indicate contributions supporting the
                  predicted class; blue bars indicate contributions
                  opposing it. Bar lengths compare magnitudes within
                  this explanation, not security risk.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default Explainability;
