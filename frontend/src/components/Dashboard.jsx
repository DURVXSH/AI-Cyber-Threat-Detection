
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const API = "http://127.0.0.1:8000";
const REFRESH_INTERVAL = 60000;
const REQUEST_TIMEOUT = 8000;

const COLORS = {
  benign: "#22c55e",
  threats: "#ef4444",
  primary: "#38bdf8",
  secondary: "#818cf8",
  grid: "#334155",
  text: "#94a3b8",
};

const cardClass =
  "bg-slate-900 border border-slate-800 rounded-xl p-6";

const chartTooltip = {
  contentStyle: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#f8fafc",
  },
  labelStyle: { color: "#cbd5e1" },
};

const number = (value) =>
  Number(value ?? 0).toLocaleString("en-IN");

const percent = (value) =>
  `${Number(value ?? 0).toFixed(2)}%`;

async function fetchJSON(path) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(`${API}${path}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function SectionTitle({ title, description }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-slate-400 text-sm mt-1">{description}</p>
    </div>
  );
}

function MetricCard({ label, value, description, color = "text-white" }) {
  return (
    <div className={cardClass}>
      <p className="text-slate-400 text-sm">{label}</p>
      <h2 className={`text-3xl font-bold mt-3 ${color}`}>
        {value}
      </h2>
      {description && (
        <p className="text-slate-500 text-sm mt-2">
          {description}
        </p>
      )}
    </div>
  );
}

function SectionMessage({ loading, error, hasData }) {
  if (error && !hasData) {
    return (
      <p className="text-amber-400 text-sm py-8" role="status">
        {error}
      </p>
    );
  }

  if (loading && !hasData) {
    return (
      <p className="text-slate-400 text-sm py-8">
        Loading section…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-amber-400 text-xs mt-3">
        Refresh failed. Showing the last available data.
      </p>
    );
  }

  return null;
}

function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [modelPerformance, setModelPerformance] = useState(null);
  const [securitySummary, setSecuritySummary] = useState(null);
  const [prediction, setPrediction] = useState(null);

  const [apiOnline, setApiOnline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errors, setErrors] = useState({});

  const mounted = useRef(false);
  const inFlight = useRef(false);

  const loadDashboardData = useCallback(async (manual = false) => {
    if (inFlight.current) return;

    inFlight.current = true;

    if (mounted.current) {
      setRefreshing(true);
    }

    const tasks = [
      {
        key: "analytics",
        path: "/analytics",
        setter: setAnalytics,
      },
      {
        key: "prediction",
        path: "/test-predict",
        setter: setPrediction,
      },
      {
        key: "modelPerformance",
        path: "/model-performance",
        setter: setModelPerformance,
      },
      {
        key: "securitySummary",
        path: "/security-summary",
        setter: setSecuritySummary,
      },
    ];

    // Each request updates its own section independently.
    const healthTask = fetchJSON("/health")
      .then(() => {
        if (!mounted.current) return;
        setApiOnline(true);
        setErrors((prev) => ({ ...prev, api: null }));
      })
      .catch((error) => {
        if (!mounted.current) return;
        setApiOnline(false);
        setErrors((prev) => ({
          ...prev,
          api: error.name === "AbortError"
            ? "Health check timed out."
            : "Backend health check failed.",
        }));
      });

    const dataTasks = tasks.map(async ({ key, path, setter }) => {
      try {
        const data = await fetchJSON(path);

        if (!mounted.current) return;

        setter(data);
        setErrors((prev) => ({ ...prev, [key]: null }));
      } catch (error) {
        if (!mounted.current) return;

        console.error(`Dashboard ${path} error:`, error);

        setErrors((prev) => ({
          ...prev,
          [key]: error.name === "AbortError"
            ? "Request timed out. Try again."
            : `Could not load this section (${error.message}).`,
        }));
      }
    });

    try {
      await Promise.all([healthTask, ...dataTasks]);

      if (mounted.current) {
        setLastUpdated(new Date());
      }
    } finally {
      inFlight.current = false;

      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    loadDashboardData();

    const interval = setInterval(
      () => loadDashboardData(),
      REFRESH_INTERVAL
    );

    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [loadDashboardData]);

  const attackData = analytics?.attack_types
    ? Object.entries(analytics.attack_types).map(([name, count]) => ({
        name,
        count: Number(count),
      }))
    : [];

  const trafficData = analytics
    ? [
        { name: "Benign", value: Number(analytics.benign_events ?? 0) },
        { name: "Threats", value: Number(analytics.threat_events ?? 0) },
      ]
    : [];

  const topAttackData = analytics?.top_attacks
    ? Object.entries(analytics.top_attacks).map(([name, count]) => ({
        name,
        count: Number(count),
      }))
    : [];

  // Backend values are already percentages: 99.89 means 99.89%.
  const performanceData = modelPerformance
    ? [
        { metric: "Accuracy", value: Number(modelPerformance.accuracy ?? 0) },
        {
          metric: "Precision",
          value: Number(modelPerformance.macro_precision ?? 0),
        },
        { metric: "Recall", value: Number(modelPerformance.macro_recall ?? 0) },
        { metric: "F1 Score", value: Number(modelPerformance.macro_f1 ?? 0) },
      ]
    : [];

  const hasAnyData = Boolean(
    analytics || modelPerformance || securitySummary || prediction
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <p className="text-sky-400 text-xs font-semibold tracking-[0.2em] uppercase mb-2">
            Security Operations Center
          </p>
          <h1 className="text-3xl font-bold">
            AI Cyber Threat Detection
          </h1>
          <p className="text-slate-400 mt-2">
            Machine-learning powered cybersecurity monitoring
          </p>
          <p className="text-slate-500 text-xs mt-2">
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : loading
                ? "Loading dashboard data…"
                : "Waiting for backend data"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              apiOnline === true
                ? "bg-green-500/10 text-green-400 border border-green-500/30"
                : apiOnline === false
                  ? "bg-red-500/10 text-red-400 border border-red-500/30"
                  : "bg-slate-800 text-slate-300 border border-slate-700"
            }`}
          >
            {apiOnline === true
              ? "● API Online"
              : apiOnline === false
                ? "● API Offline"
                : "● Checking API"}
          </div>

          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </header>

      {errors.api && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg p-4 mb-6 text-sm">
          {errors.api} Check that FastAPI is running at{" "}
          <code>127.0.0.1:8000</code>.
        </div>
      )}

      {!hasAnyData && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold">
            Dashboard data unavailable
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            The dashboard could not load data from the backend. Check
            the backend terminal for errors, then select Refresh.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <MetricCard
          label="Total Network Events"
          value={analytics ? number(analytics.total_events) : "—"}
          description="Records in the analyzed dataset"
        />
        <MetricCard
          label="Threats Detected"
          value={analytics ? number(analytics.threat_events) : "—"}
          description="Malicious traffic records"
          color="text-red-400"
        />
        <MetricCard
          label="Benign Traffic"
          value={analytics ? number(analytics.benign_events) : "—"}
          description="Non-malicious traffic records"
          color="text-green-400"
        />
        <MetricCard
          label="Threat Percentage"
          value={
            securitySummary
              ? percent(securitySummary.threat_percentage)
              : "—"
          }
          description="Share of events classified as threats"
          color="text-amber-400"
        />
      </div>

      {/* Latest Prediction */}
      <div className={`${cardClass} mb-8`}>
        <SectionTitle
          title="Latest Threat Analysis"
          description="Latest result from the prediction endpoint"
        />

        <SectionMessage
          loading={loading}
          error={errors.prediction}
          hasData={Boolean(prediction)}
        />

        {prediction && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-slate-400 text-sm">Detection</p>
              <p className="text-lg font-semibold mt-2 break-words">
                {prediction.prediction ?? "Unavailable"}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Confidence</p>
              <p className="text-lg font-semibold mt-2">
                {prediction.confidence != null
                  ? percent(
                      Number(prediction.confidence) <= 1
                        ? Number(prediction.confidence) * 100
                        : prediction.confidence
                    )
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Risk Score</p>
              <p className="text-lg font-semibold mt-2">
                {prediction.risk_score != null
                  ? `${prediction.risk_score}/100`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Severity</p>
              <p className="text-lg font-semibold mt-2 text-red-400">
                {prediction.severity ?? "N/A"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Attack Distribution and Traffic Composition */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <div className={`${cardClass} xl:col-span-2`}>
          <SectionTitle
            title="Attack Distribution"
            description="Malicious network events grouped by attack type"
          />

          <SectionMessage
            loading={loading}
            error={errors.analytics}
            hasData={attackData.length > 0}
          />

          {attackData.length > 0 && (
            <div className="w-full h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={attackData}
                  layout="vertical"
                  margin={{ top: 5, right: 24, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    stroke={COLORS.grid}
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke={COLORS.text}
                    tickFormatter={number}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={145}
                    stroke={COLORS.text}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    {...chartTooltip}
                    formatter={(value) => [number(value), "Attack Events"]}
                  />
                  <Bar
                    dataKey="count"
                    name="Attack Events"
                    fill={COLORS.primary}
                    radius={[0, 5, 5, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className={cardClass}>
          <SectionTitle
            title="Traffic Composition"
            description="Benign compared with malicious traffic"
          />

          <SectionMessage
            loading={loading}
            error={errors.analytics}
            hasData={trafficData.length > 0}
          />

          {trafficData.length > 0 && (
            <div className="w-full h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trafficData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={110}
                    innerRadius={65}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {trafficData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === "Benign"
                            ? COLORS.benign
                            : COLORS.threats
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    {...chartTooltip}
                    formatter={(value) => [number(value), "Events"]}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-slate-300 text-sm">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Top Attacks and Model Performance */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div className={cardClass}>
          <SectionTitle
            title="Top Attack Types"
            description="Most frequent malicious traffic categories"
          />

          <SectionMessage
            loading={loading}
            error={errors.analytics}
            hasData={topAttackData.length > 0}
          />

          {topAttackData.length > 0 && (
            <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topAttackData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    stroke={COLORS.grid}
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke={COLORS.text}
                    tickFormatter={number}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={135}
                    stroke={COLORS.text}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    {...chartTooltip}
                    formatter={(value) => [number(value), "Attack Events"]}
                  />
                  <Bar
                    dataKey="count"
                    name="Attack Events"
                    fill={COLORS.secondary}
                    radius={[0, 5, 5, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className={cardClass}>
          <SectionTitle
            title="Model Performance"
            description={`${modelPerformance?.model ?? "XGBoost"} classification metrics`}
          />

          <SectionMessage
            loading={loading}
            error={errors.modelPerformance}
            hasData={performanceData.length > 0}
          />

          {performanceData.length > 0 && (
            <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={performanceData}
                  margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    stroke={COLORS.grid}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis dataKey="metric" stroke={COLORS.text} />
                  <YAxis
                    domain={[0, 100]}
                    stroke={COLORS.text}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    {...chartTooltip}
                    formatter={(value) => [percent(value), "Performance"]}
                  />
                  <Bar
                    dataKey="value"
                    name="Performance"
                    fill={COLORS.primary}
                    radius={[5, 5, 0, 0]}
                    maxBarSize={58}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Security Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <MetricCard
          label="Security Status"
          value={securitySummary?.security_status ?? "—"}
          description="Based on detected threat volume"
          color="text-amber-400"
        />

        <MetricCard
          label="Total Threat Events"
          value={
            securitySummary
              ? number(securitySummary.threat_events)
              : "—"
          }
          description="Threat events in the dataset"
          color="text-red-400"
        />

        <MetricCard
          label="Model Accuracy"
          value={
            modelPerformance
              ? percent(modelPerformance.accuracy)
              : "—"
          }
          description="Overall classification accuracy"
          color="text-green-400"
        />
      </div>

      <SectionMessage
        loading={loading}
        error={errors.securitySummary}
        hasData={Boolean(securitySummary)}
      />

      {/* AI Engine Information */}
      <div className={cardClass}>
        <SectionTitle
          title="AI Detection Engine"
          description="Machine-learning configuration"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-slate-400 text-sm">Machine Learning Model</p>
            <p className="text-lg font-semibold mt-2">
              {modelPerformance?.model ?? "XGBoost"}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Dataset</p>
            <p className="text-lg font-semibold mt-2">CIC-IDS2017</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Input Features</p>
            <p className="text-lg font-semibold mt-2">78 Network Features</p>
          </div>
        </div>
      </div>

      <p className="text-slate-600 text-xs text-center mt-8">
        CyberGuard SOC · Background refresh every 60 seconds
      </p>
    </div>
  );
}

export default Dashboard;
