import { useEffect, useState } from "react";

function ThreatHistory() {

  const [history, setHistory] = useState([]);
  const [statistics, setStatistics] = useState({
    total: 0,
    threats: 0,
    benign: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchHistory = async () => {

    try {

      setLoading(true);
      setError("");

      const response = await fetch(
        "http://127.0.0.1:8000/threat-history"
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch threat history"
        );
      }

      const data = await response.json();

      setHistory(data.history || []);

      setStatistics(
        data.statistics || {
          total: 0,
          threats: 0,
          benign: 0
        }
      );

    } catch (err) {

      console.error(err);

      setError(
        "Unable to load threat history."
      );

    } finally {

      setLoading(false);

    }
  };


  useEffect(() => {

    fetchHistory();

  }, []);


  const clearHistory = async () => {

    const confirmed = window.confirm(
      "Are you sure you want to delete all threat history?"
    );

    if (!confirmed) {
      return;
    }

    try {

      const response = await fetch(
        "http://127.0.0.1:8000/threat-history",
        {
          method: "DELETE"
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to clear history"
        );
      }

      await fetchHistory();

    } catch (err) {

      console.error(err);

      setError(
        "Unable to clear threat history."
      );

    }
  };


  const getSeverityClass = (severity) => {

    if (severity === "CRITICAL") {
      return "bg-red-500/20 text-red-400 border border-red-500/30";
    }

    if (severity === "HIGH") {
      return "bg-orange-500/20 text-orange-400 border border-orange-500/30";
    }

    if (severity === "MEDIUM") {
      return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    }

    return "bg-green-500/20 text-green-400 border border-green-500/30";
  };


  const formatDate = (timestamp) => {

    if (!timestamp) {
      return "-";
    }

    return new Date(
      timestamp
    ).toLocaleString();

  };


  return (

    <div className="min-h-screen bg-slate-950 text-white p-6">

      <div className="max-w-7xl mx-auto">

        {/* HEADER */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">

          <div>

            <h1 className="text-3xl font-bold">
              Threat History
            </h1>

            <p className="text-slate-400 mt-1">
              Historical network threat detections
            </p>

          </div>

          <button
            onClick={clearHistory}
            className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 transition font-medium"
          >
            Clear History
          </button>

        </div>


        {/* ERROR */}

        {error && (

          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">

            {error}

          </div>

        )}


        {/* STATISTICS */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

            <p className="text-slate-400 text-sm">
              Total Stored Events
            </p>

            <p className="text-3xl font-bold mt-2">
              {statistics.total.toLocaleString()}
            </p>

          </div>


          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

            <p className="text-slate-400 text-sm">
              Threats
            </p>

            <p className="text-3xl font-bold text-red-400 mt-2">
              {statistics.threats.toLocaleString()}
            </p>

          </div>


          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

            <p className="text-slate-400 text-sm">
              Benign
            </p>

            <p className="text-3xl font-bold text-green-400 mt-2">
              {statistics.benign.toLocaleString()}
            </p>

          </div>

        </div>


        {/* TABLE */}

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">

          <div className="p-5 border-b border-slate-800">

            <h2 className="text-lg font-semibold">
              Detection Records
            </h2>

          </div>


          {loading ? (

            <div className="p-10 text-center text-slate-400">

              Loading threat history...

            </div>

          ) : history.length === 0 ? (

            <div className="p-10 text-center text-slate-400">

              No threat history available yet.

              <p className="text-sm mt-2">
                Run a prediction or upload a CSV to create records.
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-slate-800/60">

                  <tr>

                    <th className="text-left px-5 py-4">
                      Time
                    </th>

                    <th className="text-left px-5 py-4">
                      Detection
                    </th>

                    <th className="text-left px-5 py-4">
                      Confidence
                    </th>

                    <th className="text-left px-5 py-4">
                      Risk
                    </th>

                    <th className="text-left px-5 py-4">
                      Severity
                    </th>

                    <th className="text-left px-5 py-4">
                      Source
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {history.map((item) => (

                    <tr
                      key={item.id}
                      className="border-t border-slate-800 hover:bg-slate-800/40 transition"
                    >

                      <td className="px-5 py-4 text-slate-300 whitespace-nowrap">

                        {formatDate(
                          item.timestamp
                        )}

                      </td>


                      <td className="px-5 py-4">

                        <span
                          className={
                            item.prediction === "BENIGN"
                              ? "text-green-400"
                              : "text-red-400 font-medium"
                          }
                        >

                          {item.prediction}

                        </span>

                      </td>


                      <td className="px-5 py-4">

                        {(item.confidence * 100).toFixed(2)}
                        %

                      </td>


                      <td className="px-5 py-4">

                        <span className="font-semibold">

                          {item.risk_score}/100

                        </span>

                      </td>


                      <td className="px-5 py-4">

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityClass(
                            item.severity
                          )}`}
                        >

                          {item.severity}

                        </span>

                      </td>


                      <td className="px-5 py-4 text-slate-400 max-w-xs truncate">

                        {item.source}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </div>

  );

}

export default ThreatHistory;