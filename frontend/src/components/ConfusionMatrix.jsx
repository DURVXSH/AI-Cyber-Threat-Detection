
import { useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000/confusion-matrix";

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString();
}

export default function ConfusionMatrix() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [normalize, setNormalize] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMatrix() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success || !Array.isArray(result.matrix)) {
          throw new Error(result.error || "Invalid confusion matrix response.");
        }

        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load the confusion matrix.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMatrix();

    return () => {
      cancelled = true;
    };
  }, []);

  const matrixInfo = useMemo(() => {
    if (!data) return null;

    const matrix = data.matrix;
    const labels = data.class_labels;
    const rowTotals = matrix.map((row) =>
      row.reduce((sum, value) => sum + value, 0)
    );
    const maxValue = Math.max(1, ...matrix.flat());

    return { matrix, labels, rowTotals, maxValue };
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 text-slate-300">
        Loading confusion matrix...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6 text-red-300">
        <h2 className="text-lg font-semibold">Could not load confusion matrix</h2>
        <p className="mt-2 break-all">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600"
        >
          Reload page
        </button>
      </div>
    );
  }

  if (!matrixInfo) return null;

  const { matrix, labels, rowTotals, maxValue } = matrixInfo;
  const total = matrix.flat().reduce((sum, value) => sum + value, 0);
  const correct = matrix.reduce(
    (sum, row, index) => sum + (row[index] || 0),
    0
  );
  const incorrect = total - correct;

  function getCellValue(rowIndex, colIndex) {
    const raw = matrix[rowIndex][colIndex] || 0;
    if (!normalize) return raw;
    const rowTotal = rowTotals[rowIndex];
    return rowTotal ? (raw / rowTotal) * 100 : 0;
  }

  function getCellStyle(rowIndex, colIndex) {
    const value = getCellValue(rowIndex, colIndex);
    const intensity = normalize
      ? value / 100
      : value / maxValue;

    if (rowIndex === colIndex) {
      return {
        backgroundColor: `rgba(16, 185, 129, ${0.12 + intensity * 0.78})`,
        color: intensity > 0.45 ? "#ffffff" : "#a7f3d0",
        border: "1px solid rgba(52, 211, 153, 0.22)",
      };
    }

    return {
      backgroundColor: `rgba(96, 165, 250, ${0.04 + intensity * 0.75})`,
      color: intensity > 0.45 ? "#ffffff" : "#cbd5e1",
      border: "1px solid rgba(148, 163, 184, 0.10)",
    };
  }

  return (
    <div className="space-y-6 text-slate-100">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Machine Learning Analytics
        </p>
        <h1 className="mt-2 text-3xl font-bold">Confusion Matrix</h1>
        <p className="mt-2 text-sm text-slate-400">
          XGBoost classification results on the reconstructed CIC-IDS2017 test split.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Model" value={data.model || "XGBoost"} />
        <MetricCard
          label="Test Samples"
          value={formatNumber(data.test_samples)}
        />
        <MetricCard
          label="Correct Predictions"
          value={formatNumber(data.correct_predictions ?? correct)}
        />
        <MetricCard
          label="Accuracy"
          value={`${Number(data.accuracy_percent).toFixed(3)}%`}
        />
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold">Class-by-class results</h2>
            <p className="mt-1 text-sm text-slate-400">
              Green diagonal cells are correct predictions. Blue off-diagonal cells show misclassifications.
            </p>
          </div>

          <button
            onClick={() => setNormalize((value) => !value)}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-800"
          >
            {normalize ? "Show raw counts" : "Normalize by actual class"}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-300">
          <span>Correct: {formatNumber(correct)}</span>
          <span>Incorrect: {formatNumber(incorrect)}</span>
          <span>Classes: {labels.length}</span>
        </div>

        <div className="mt-5 overflow-auto rounded-xl border border-slate-700">
          <table className="border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-32 bg-slate-900 p-2 text-left text-slate-400">
                  Actual ↓ / Predicted →
                </th>
                {labels.map((label, index) => (
                  <th
                    key={`${label}-${index}`}
                    title={label}
                    className="min-w-16 max-w-20 p-2 text-center font-medium text-slate-300"
                  >
                    <span className="block max-w-20 break-all">
                      {label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {matrix.map((row, rowIndex) => (
                <tr key={labels[rowIndex]}>
                  <th
                    title={labels[rowIndex]}
                    className="sticky left-0 z-10 min-w-32 bg-slate-900 p-2 text-left font-medium text-slate-300"
                  >
                    <span className="block max-w-36 break-all">
                      {labels[rowIndex]}
                    </span>
                  </th>

                  {row.map((value, colIndex) => {
                    const displayValue = getCellValue(rowIndex, colIndex);
                    const isSelected =
                      selected?.row === rowIndex &&
                      selected?.col === colIndex;

                    return (
                      <td key={`${rowIndex}-${colIndex}`} className="p-0">
                        <button
                          type="button"
                          onClick={() =>
                            setSelected({ row: rowIndex, col: colIndex })
                          }
                          title={`${labels[rowIndex]} predicted as ${labels[colIndex]}: ${formatNumber(value)}`}
                          aria-label={`Actual ${labels[rowIndex]}, predicted ${labels[colIndex]}, count ${value}`}
                          style={{
                            ...getCellStyle(rowIndex, colIndex),
                            outline: isSelected
                              ? "2px solid white"
                              : "none",
                            outlineOffset: "-2px",
                          }}
                          className="h-10 min-w-16 rounded-sm px-1 text-center transition hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-white"
                        >
                          {normalize
                            ? `${displayValue.toFixed(1)}%`
                            : formatNumber(value)}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Select any cell to inspect its actual class, predicted class, and count.
        </p>

        {selected && (
          <div className="mt-4 rounded-xl border border-cyan-500/30 bg-slate-800 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-cyan-300">Selected cell</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-sm text-slate-400 hover:text-white"
              >
                Clear
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Actual class:{" "}
              <span className="font-semibold text-white">
                {labels[selected.row]}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Predicted class:{" "}
              <span className="font-semibold text-white">
                {labels[selected.col]}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Count:{" "}
              <span className="font-semibold text-white">
                {formatNumber(matrix[selected.row][selected.col])}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {selected.row === selected.col
                ? "Correct classification."
                : "Misclassification: the model predicted a different class."}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 text-sm text-amber-200">
        <strong>Interpretation:</strong> Accuracy can be high when common classes
        dominate the dataset. Review individual class rows and normalized
        percentages to identify attack types that may be missed.
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 break-all text-2xl font-bold text-cyan-300">
        {value}
      </p>
    </div>
  );
}
