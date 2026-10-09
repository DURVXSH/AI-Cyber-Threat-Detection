
import { useEffect, useState } from "react";
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

function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [modelPerformance, setModelPerformance] = useState(null);
  const [securitySummary, setSecuritySummary] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  // Attack distribution data
  const attackData = analytics
    ? Object.entries(analytics.attack_types).map(
        ([name, count]) => ({
          name,
          count,
        })
      )
    : [];

  // Benign vs Threat data
  const trafficData = analytics
    ? [
        {
          name: "Benign",
          value: analytics.benign_events,
        },
        {
          name: "Threats",
          value: analytics.threat_events,
        },
      ]
    : [];

  // Top 5 attack types
  const topAttackData = analytics
    ? Object.entries(analytics.top_attacks).map(
        ([name, count]) => ({
          name,
          count,
        })
      )
    : [];

  // Model performance data
  const performanceData = modelPerformance
    ? [
        {
          metric: "Accuracy",
          value: modelPerformance.accuracy,
        },
        {
          metric: "Precision",
          value: modelPerformance.macro_precision,
        },
        {
          metric: "Recall",
          value: modelPerformance.macro_recall,
        },
        {
          metric: "F1 Score",
          value: modelPerformance.macro_f1,
        },
      ]
    : [];

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Check API health
        const healthResponse = await fetch(
          "http://127.0.0.1:8000/health"
        );

        if (!healthResponse.ok) {
          throw new Error("API is not available");
        }

        setApiOnline(true);

        // Get dataset analytics
        const analyticsResponse = await fetch(
          "http://127.0.0.1:8000/analytics"
        );

        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData);

        // Get latest prediction
        const predictionResponse = await fetch(
          "http://127.0.0.1:8000/test-predict"
        );

        const predictionData = await predictionResponse.json();
        setPrediction(predictionData);

        // Get model performance
        const modelPerformanceResponse = await fetch(
          "http://127.0.0.1:8000/model-performance"
        );

        const modelPerformanceData =
          await modelPerformanceResponse.json();

        setModelPerformance(modelPerformanceData);

        // Get security summary
        const securitySummaryResponse = await fetch(
          "http://127.0.0.1:8000/security-summary"
        );

        const securitySummaryData =
          await securitySummaryResponse.json();

        setSecuritySummary(securitySummaryData);

      } catch (error) {
        console.error("Dashboard error:", error);
        setApiOnline(false);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-xl">
          Loading AI Cyber Threat Detection Platform...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">

        <div>
          <h1 className="text-3xl font-bold">
            AI Cyber Threat Detection
          </h1>

          <p className="text-slate-400 mt-2">
            Machine-learning powered cybersecurity monitoring
          </p>
        </div>

        <div
          className={`px-4 py-2 rounded-full text-sm font-semibold ${
            apiOnline
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {apiOnline
            ? "● API Online"
            : "● API Offline"}
        </div>

      </div>


      {/* KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <p className="text-slate-400">
              Total Network Events
            </p>

            <h2 className="text-3xl font-bold mt-2">
              {analytics.total_events.toLocaleString()}
            </h2>
          </div>


          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <p className="text-slate-400">
              Threats Detected
            </p>

            <h2 className="text-3xl font-bold text-red-400 mt-2">
              {analytics.threat_events.toLocaleString()}
            </h2>
          </div>


          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <p className="text-slate-400">
              Benign Traffic
            </p>

            <h2 className="text-3xl font-bold text-green-400 mt-2">
              {analytics.benign_events.toLocaleString()}
            </h2>
          </div>

        </div>
      )}


      {/* Latest Threat */}
      {prediction && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">

          <h2 className="text-xl font-semibold mb-6">
            Latest Threat Analysis
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

            <div>
              <p className="text-slate-400 text-sm">
                Detection
              </p>

              <p className="text-lg font-semibold mt-1">
                {prediction.prediction}
              </p>
            </div>


            <div>
              <p className="text-slate-400 text-sm">
                Confidence
              </p>

              <p className="text-lg font-semibold mt-1">
                {(prediction.confidence * 100).toFixed(2)}%
              </p>
            </div>


            <div>
              <p className="text-slate-400 text-sm">
                Risk Score
              </p>

              <p className="text-lg font-semibold mt-1">
                {prediction.risk_score}/100
              </p>
            </div>


            <div>
              <p className="text-slate-400 text-sm">
                Severity
              </p>

              <p className="text-lg font-semibold text-red-400 mt-1">
                {prediction.severity}
              </p>
            </div>

          </div>

        </div>
      )}


      {/* Security Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Attack Distribution */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">

          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              Attack Distribution
            </h2>

            <p className="text-slate-400 text-sm mt-1">
              Distribution of malicious traffic by attack type
            </p>
          </div>

          <div
            className="w-full"
            style={{ height: "500px" }}
          >

            <ResponsiveContainer width="100%" height="100%">

              <BarChart
                data={attackData}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 30,
                  left: 30,
                  bottom: 10,
                }}
              >

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  type="number"
                  tickFormatter={(value) =>
                    value.toLocaleString()
                  }
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                />

                <Tooltip
                  formatter={(value) =>
                    value.toLocaleString()
                  }
                />

                <Bar
                  dataKey="count"
                  name="Attack Events"
                  radius={[0, 6, 6, 0]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>


        {/* Traffic Composition */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              Traffic Composition
            </h2>

            <p className="text-slate-400 text-sm mt-1">
              Benign vs malicious traffic
            </p>
          </div>

          <div
            className="w-full"
            style={{ height: "500px" }}
          >

            <ResponsiveContainer width="100%" height="100%">

              <PieChart>

                <Pie
                  data={trafficData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={140}
                  innerRadius={80}
                  paddingAngle={3}
                >

                  {trafficData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                    />
                  ))}

                </Pie>

                <Tooltip
                  formatter={(value) =>
                    value.toLocaleString()
                  }
                />

                <Legend />

              </PieChart>

            </ResponsiveContainer>

          </div>

        </div>

      </div>


      {/* Additional Security Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Top Attack Types */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              Top Attack Types
            </h2>

            <p className="text-slate-400 text-sm mt-1">
              Most frequent malicious traffic detected
            </p>
          </div>

          <div
            className="w-full"
            style={{ height: "350px" }}
          >

            <ResponsiveContainer width="100%" height="100%">

              <BarChart
                data={topAttackData}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 30,
                  left: 30,
                  bottom: 10,
                }}
              >

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  type="number"
                  tickFormatter={(value) =>
                    value.toLocaleString()
                  }
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                />

                <Tooltip
                  formatter={(value) =>
                    value.toLocaleString()
                  }
                />

                <Bar
                  dataKey="count"
                  name="Attack Events"
                  radius={[0, 6, 6, 0]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>


        {/* Model Performance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              Model Performance
            </h2>

            <p className="text-slate-400 text-sm mt-1">
              XGBoost classification performance
            </p>
          </div>

          <div
            className="w-full"
            style={{ height: "350px" }}
          >

            <ResponsiveContainer width="100%" height="100%">

              <BarChart
                data={performanceData}
                margin={{
                  top: 20,
                  right: 20,
                  left: 10,
                  bottom: 10,
                }}
              >

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="metric"
                />

                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) =>
                    `${value}%`
                  }
                />

                <Tooltip
                  formatter={(value) =>
                    `${value}%`
                  }
                />

                <Bar
                  dataKey="value"
                  name="Performance"
                  radius={[6, 6, 0, 0]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

      </div>


      {/* Security Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

        {/* Security Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

          <p className="text-slate-400 text-sm">
            Security Status
          </p>

          <h2 className="text-3xl font-bold mt-3">
            {securitySummary?.security_status ||
              "Loading..."}
          </h2>

          <p className="text-slate-400 text-sm mt-2">
            Based on detected threat volume
          </p>

        </div>


        {/* Threat Percentage */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

          <p className="text-slate-400 text-sm">
            Threat Percentage
          </p>

          <h2 className="text-3xl font-bold mt-3">
            {securitySummary
              ? `${securitySummary.threat_percentage}%`
              : "Loading..."}
          </h2>

          <p className="text-slate-400 text-sm mt-2">
            Percentage of network events classified as threats
          </p>

        </div>


        {/* Threat Events */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

          <p className="text-slate-400 text-sm">
            Total Threat Events
          </p>

          <h2 className="text-3xl font-bold mt-3">
            {securitySummary
              ? securitySummary.threat_events.toLocaleString()
              : "Loading..."}
          </h2>

          <p className="text-slate-400 text-sm mt-2">
            Malicious network events in CIC-IDS2017
          </p>

        </div>

      </div>


      {/* Model Information */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

        <h2 className="text-xl font-semibold mb-6">
          AI Detection Engine
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div>
            <p className="text-slate-400 text-sm">
              Machine Learning Model
            </p>

            <p className="text-lg font-semibold mt-1">
              XGBoost
            </p>
          </div>


          <div>
            <p className="text-slate-400 text-sm">
              Dataset
            </p>

            <p className="text-lg font-semibold mt-1">
              CIC-IDS2017
            </p>
          </div>


          <div>
            <p className="text-slate-400 text-sm">
              Input Features
            </p>

            <p className="text-lg font-semibold mt-1">
              78 Network Features
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}

export default Dashboard;
