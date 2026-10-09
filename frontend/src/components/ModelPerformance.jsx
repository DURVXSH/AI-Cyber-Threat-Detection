
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const API_URL = "http://127.0.0.1:8000";

function MetricCard({ title, value, description }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function ModelPerformance() {
  const [models, setModels] = useState([]);
  const [bestModel, setBestModel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPerformance() {
      try {
        const response = await fetch(`${API_URL}/model-comparison`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Could not load model comparison."
          );
        }

        setModels(data.models || []);
        setBestModel(data.best_model || null);
      } catch (err) {
        setError(err.message || "Unable to reach the backend.");
      } finally {
        setLoading(false);
      }
    }

    loadPerformance();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-slate-300">
        Loading model performance...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-red-400">
        {error}
      </div>
    );
  }

  const metricData = models.map((item) => ({
    model: item.model,
    Accuracy: item.accuracy,
    "Macro F1": item.macro_f1,
    "Macro Recall": item.macro_recall,
  }));

  const timeData = models.map((item) => ({
    model: item.model,
    Training: item.training_time_seconds,
    Prediction: item.prediction_time_seconds,
  }));

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-400">
            MACHINE LEARNING ANALYTICS
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            Model Performance
          </h1>
          <p className="mt-2 text-slate-400">
            Compare the five trained classifiers using the saved
            CIC-IDS2017 benchmark results.
          </p>
        </div>

        {models.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
            No model comparison results are available.
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Models Evaluated"
                value={models.length}
                description="Saved benchmark results"
              />
              <MetricCard
                title="Best Macro F1"
                value={`${bestModel?.macro_f1 ?? "—"}%`}
                description={bestModel?.model ?? "Best model"}
              />
              <MetricCard
                title="Best Accuracy"
                value={`${Math.max(
                  ...models.map((item) => item.accuracy)
                ).toFixed(3)}%`}
                description="Highest recorded accuracy"
              />
              <MetricCard
                title="Fastest Training"
                value={`${Math.min(
                  ...models.map((item) => item.training_time_seconds)
                ).toFixed(1)} s`}
                description="Recorded training duration"
              />
            </div>

            <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-2 text-xl font-semibold">
                Model Metric Comparison
              </h2>
              <p className="mb-6 text-sm text-slate-400">
                Compare accuracy, macro F1 and macro recall.
                Macro metrics give each attack class equal weight.
              </p>

              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metricData}
                    margin={{ top: 10, right: 15, left: 0, bottom: 45 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#334155"
                    />
                    <XAxis
                      dataKey="model"
                      angle={-15}
                      textAnchor="end"
                      interval={0}
                      height={65}
                      tick={{ fill: "#cbd5e1", fontSize: 11 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "#cbd5e1" }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      formatter={(value) => `${value}%`}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Accuracy" fill="#60a5fa" />
                    <Bar dataKey="Macro F1" fill="#34d399" />
                    <Bar dataKey="Macro Recall" fill="#fbbf24" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-2 text-xl font-semibold">
                Training and Prediction Time
              </h2>
              <p className="mb-6 text-sm text-slate-400">
                Recorded benchmark durations in seconds. These can
                vary by hardware and input size.
              </p>

              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={timeData}
                    margin={{ top: 10, right: 15, left: 10, bottom: 45 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#334155"
                    />
                    <XAxis
                      dataKey="model"
                      angle={-15}
                      textAnchor="end"
                      interval={0}
                      height={65}
                      tick={{ fill: "#cbd5e1", fontSize: 11 }}
                    />
                    <YAxis tick={{ fill: "#cbd5e1" }} />
                    <Tooltip
                      formatter={(value) => `${value} seconds`}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Training" fill="#a78bfa" />
                    <Bar dataKey="Prediction" fill="#fb923c" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 p-5">
                <h2 className="text-xl font-semibold">
                  Detailed Comparison
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      {[
                        "Model",
                        "Accuracy",
                        "Precision",
                        "Recall",
                        "Macro F1",
                        "Weighted F1",
                        "Training (s)",
                        "Prediction (s)",
                      ].map((heading) => (
                        <th key={heading} className="whitespace-nowrap px-4 py-3">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((item) => (
                      <tr
                        key={item.model}
                        className="border-t border-slate-800"
                      >
                        <td className="whitespace-nowrap px-4 py-4 font-medium">
                          {item.model}
                          {item.model === bestModel?.model && (
                            <span className="ml-2 rounded-full bg-green-500/15 px-2 py-1 text-xs text-green-400">
                              Best Macro F1
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">{item.accuracy}%</td>
                        <td className="px-4 py-4">{item.macro_precision}%</td>
                        <td className="px-4 py-4">{item.macro_recall}%</td>
                        <td className="px-4 py-4 font-semibold">
                          {item.macro_f1}%
                        </td>
                        <td className="px-4 py-4">{item.weighted_f1}%</td>
                        <td className="px-4 py-4">
                          {item.training_time_seconds}
                        </td>
                        <td className="px-4 py-4">
                          {item.prediction_time_seconds}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              These are saved benchmark results, not live retraining.
              Macro F1 is useful for comparing performance across
              imbalanced attack classes; accuracy alone can hide
              weak performance on rare attacks.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default ModelPerformance;
