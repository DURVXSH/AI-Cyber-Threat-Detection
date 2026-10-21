
import { useEffect, useRef, useState } from "react";

const API_URL = "http://127.0.0.1:8000";
const UPLOAD_TIMEOUT_MS = 30 * 60 * 1000;

function getErrorMessage(data, fallback = "CSV analysis failed.") {
  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    const detail = data.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (detail && typeof detail === "object") {
      if (typeof detail.message === "string") {
        const missing = detail.missing_features;

        if (Array.isArray(missing) && missing.length > 0) {
          return `${detail.message} Missing: ${missing.join(", ")}`;
        }

        return detail.message;
      }

      if (typeof detail.error === "string") {
        return detail.error;
      }

      if (Array.isArray(detail)) {
        return detail
          .map((item) => {
            if (typeof item === "string") return item;
            if (item?.msg) return item.msg;
            return JSON.stringify(item);
          })
          .join("; ");
      }

      return JSON.stringify(detail);
    }

    if (typeof data.error === "string") {
      return data.error;
    }

    if (typeof data.message === "string") {
      return data.message;
    }
  }

  return fallback;
}

async function readResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function StatCard({ label, value, description }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold text-white">
        {value}
      </p>
      {description && (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      )}
    </div>
  );
}

export default function ThreatDetection() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [progress, setProgress] = useState({
    status: "idle",
    processed: 0,
    batch: 0,
    message: "Choose a CSV file to begin analysis.",
  });

  const timerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const activeJobRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const stopTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const pollProgress = async (jobId) => {
    try {
      const response = await fetch(
        `${API_URL}/predict-csv/progress/${encodeURIComponent(jobId)}`
      );

      const data = await readResponse(response);

      if (!response.ok) {
        return;
      }

      setProgress((previous) => ({
        ...previous,
        status: data.status || previous.status,
        processed: Number(data.processed ?? previous.processed),
        batch: Number(data.batch ?? previous.batch),
        message: data.message || previous.message,
      }));
    } catch (pollError) {
      // Progress polling is optional. The main upload request
      // remains responsible for reporting analysis errors.
      console.warn("Could not retrieve CSV progress:", pollError);
    }
  };

  const analyzeCSV = async (event) => {
    event?.preventDefault();

    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only CSV files are supported.");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError("The file exceeds the 100 MB upload limit.");
      return;
    }

    stopTimers();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const jobId =
      globalThis.crypto?.randomUUID?.() ||
      `csv-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    activeJobRef.current = jobId;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("job_id", jobId);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, UPLOAD_TIMEOUT_MS);

    setLoading(true);
    setResult(null);
    setError("");
    setElapsedSeconds(0);

    setProgress({
      status: "processing",
      processed: 0,
      batch: 0,
      message: "Uploading and validating CSV...",
    });

    timerRef.current = setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    // Poll without overlapping progress requests.
    let polling = false;

    const pollSafely = async () => {
      if (polling) return;

      polling = true;

      try {
        await pollProgress(jobId);
      } finally {
        polling = false;
      }
    };

    progressTimerRef.current = setInterval(pollSafely, 1500);

    try {
      // Start polling immediately as well.
      void pollSafely();

      const response = await fetch(`${API_URL}/predict-csv`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            `Server request failed with status ${response.status}.`
          )
        );
      }

      if (data.success !== true) {
        throw new Error(
          getErrorMessage(data, "The server did not complete the analysis.")
        );
      }

      setResult(data);

      setProgress({
        status: "completed",
        processed: Number(data.total_records || 0),
        batch: 0,
        message: "CSV analysis completed successfully.",
      });
    } catch (err) {
      console.error("CSV analysis error:", err);

      let message;

      if (err?.name === "AbortError") {
        message =
          "The request was cancelled or exceeded the 30-minute timeout. Check the backend terminal before trying again.";
      } else if (err instanceof TypeError) {
        message =
          "Cannot connect to the backend. Make sure FastAPI is running at http://127.0.0.1:8000.";
      } else {
        message =
          typeof err?.message === "string" && err.message
            ? err.message
            : "CSV analysis failed. Check the backend terminal.";
      }

      setError(message);

      setProgress((previous) => ({
        ...previous,
        status: "failed",
        message,
      }));
    } finally {
      clearTimeout(timeoutId);
      stopTimers();

      if (activeJobRef.current === jobId) {
        setLoading(false);
      }
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;

    setFile(selectedFile);
    setResult(null);
    setError("");
    setElapsedSeconds(0);

    setProgress({
      status: "idle",
      processed: 0,
      batch: 0,
      message: selectedFile
        ? `Ready to analyze ${selectedFile.name}.`
        : "Choose a CSV file to begin analysis.",
    });
  };

  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(elapsedSeconds % 60)
    .toString()
    .padStart(2, "0")}`;

  const attackTypes = Object.entries(result?.attack_types || {}).sort(
    (a, b) => b[1] - a[1]
  );

  const severities = Object.entries(
    result?.severity_distribution || {}
  ).sort((a, b) => b[1] - a[1]);

  const preview = Array.isArray(result?.results_preview)
    ? result.results_preview
    : [];

  return (
    <div className="min-h-screen space-y-6 bg-slate-950 p-4 text-slate-100 sm:p-6 lg:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          CyberGuard AI
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Threat Detection
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Analyze network traffic CSV files with the trained XGBoost threat
          classifier and review threat severity, attack categories, and
          prediction results.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Upload network traffic</h2>
        <p className="mt-1 text-sm text-slate-400">
          Upload a CSV containing all required model features. Files up to
          100 MB are accepted by this endpoint.
        </p>

        <form onSubmit={analyzeCSV} className="mt-5 space-y-4">
          <label
            htmlFor="traffic-csv"
            className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-950/60 p-5 text-center transition hover:border-cyan-500"
          >
            <span className="text-sm font-semibold text-slate-200">
              {file ? file.name : "Choose a CSV file"}
            </span>

            <span className="mt-2 text-xs text-slate-500">
              {file
                ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                : "Click here to browse files"}
            </span>

            <input
              id="traffic-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={loading}
              className="sr-only"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!file || loading}
              className="rounded-lg bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Analyzing traffic..." : "Analyze CSV"}
            </button>

            {loading && (
              <span className="text-sm text-slate-400">
                Elapsed time: {elapsedLabel}
              </span>
            )}
          </div>
        </form>
      </section>

      {(loading || progress.status !== "idle") && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">
                {loading ? "Analyzing network traffic" : "Analysis status"}
              </h2>
              <p className="mt-1 break-words text-sm text-slate-400">
                {progress.message}
              </p>
            </div>

            {loading && (
              <span className="text-sm text-cyan-400">
                {formatNumber(progress.processed)} records processed
              </span>
            )}
          </div>

          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"
            role="progressbar"
            aria-label="CSV analysis progress"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progress.status === "failed"
                  ? "bg-red-500"
                  : progress.status === "completed"
                    ? "w-full bg-emerald-400"
                    : "w-2/5 animate-pulse bg-cyan-400"
              }`}
              style={
                progress.status === "completed" ||
                progress.status === "failed"
                  ? undefined
                  : { width: "40%" }
              }
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>Batch: {formatNumber(progress.batch)}</span>
            <span>Processed: {formatNumber(progress.processed)} records</span>
            <span>Elapsed: {elapsedLabel}</span>
          </div>
        </section>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-950/40 p-4"
        >
          <h2 className="font-semibold text-red-300">
            CSV analysis failed
          </h2>
          <p className="mt-2 break-words text-sm text-red-200">{error}</p>
        </div>
      )}

      {result && (
        <>
          <section>
            <h2 className="mb-4 text-xl font-bold">Analysis summary</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Records analyzed"
                value={formatNumber(result.total_records)}
                description="Total rows processed"
              />
              <StatCard
                label="Threat records"
                value={formatNumber(result.threat_records)}
                description="Rows classified as non-benign"
              />
              <StatCard
                label="Benign records"
                value={formatNumber(result.benign_records)}
                description="Rows classified as benign"
              />
              <StatCard
                label="Threat percentage"
                value={`${Number(result.threat_percentage || 0).toFixed(2)}%`}
                description="Threat records / total records"
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-lg font-semibold">Attack distribution</h2>

              {attackTypes.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">
                  No non-benign predictions were found.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {attackTypes.map(([name, count]) => {
                    const percentage =
                      result.total_records > 0
                        ? (count / result.total_records) * 100
                        : 0;

                    return (
                      <div key={name}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                          <span className="break-words text-slate-300">
                            {name}
                          </span>
                          <span className="shrink-0 text-slate-400">
                            {formatNumber(count)} ({percentage.toFixed(1)}%)
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-cyan-400"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-lg font-semibold">Severity distribution</h2>

              {severities.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">
                  No severity data is available.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {severities.map(([severity, count]) => (
                    <div
                      key={severity}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <span className="text-sm text-slate-300">
                        {severity}
                      </span>
                      <span className="font-semibold text-white">
                        {formatNumber(count)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="border-b border-slate-800 p-5">
              <h2 className="text-lg font-semibold">Prediction preview</h2>
              <p className="mt-1 text-sm text-slate-400">
                Showing {preview.length} of{" "}
                {formatNumber(result.total_records)} processed records.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Prediction</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Risk score</th>
                    <th className="px-4 py-3">Severity</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {preview.map((item, index) => (
                    <tr
                      key={`${index}-${item.Prediction}`}
                      className="hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-200">
                        {item.Prediction}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {(Number(item.Confidence || 0) * 100).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {item["Risk Score"]}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {item.Severity}
                      </td>
                    </tr>
                  ))}

                  {preview.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-500"
                      >
                        No preview records are available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
