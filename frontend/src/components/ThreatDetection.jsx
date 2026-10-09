import { useState } from "react";

function ThreatDetection() {

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");


  // --------------------------------------------------
  // File Selection
  // --------------------------------------------------

  const handleFileChange = (event) => {

    const selectedFile = event.target.files[0];

    setFile(selectedFile);
    setResult(null);
    setError("");
  };


  // --------------------------------------------------
  // CSV Prediction
  // --------------------------------------------------

  const analyzeCSV = async () => {

    if (!file) {

      setError("Please select a CSV file first.");

      return;
    }


    setLoading(true);
    setResult(null);
    setError("");


    try {

      const formData = new FormData();

      formData.append(
        "file",
        file
      );


      const response = await fetch(
        "http://127.0.0.1:8000/predict-csv",
        {
          method: "POST",
          body: formData
        }
      );


      const data = await response.json();


      if (!response.ok || !data.success) {

        throw new Error(
          data.error ||
          "CSV analysis failed."
        );
      }


      setResult(data);

    }

    catch (err) {

      console.error(err);

      setError(
        err.message
      );

    }

    finally {

      setLoading(false);

    }

  };


  return (

    <div className="min-h-screen bg-slate-950 text-white p-8">


      {/* ------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------ */}

      <div className="mb-8">

        <h1 className="text-3xl font-bold">
          Threat Detection
        </h1>

        <p className="text-slate-400 mt-2">
          Analyze network traffic using the XGBoost
          cybersecurity detection engine
        </p>

      </div>


      {/* ------------------------------------------------ */}
      {/* Upload Section */}
      {/* ------------------------------------------------ */}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">


        <h2 className="text-xl font-semibold">
          CSV Batch Analysis
        </h2>


        <p className="text-slate-400 text-sm mt-2">
          Upload a CIC-IDS2017-compatible CSV file
          containing the 78 network traffic features.
        </p>


        {/* Upload Box */}

        <div className="mt-6 border-2 border-dashed border-slate-700 rounded-xl p-10 text-center hover:border-blue-500 transition">

          <div className="text-4xl mb-4">
            📁
          </div>


          <p className="text-slate-300 mb-4">
            Select network traffic CSV
          </p>


          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full max-w-md mx-auto text-sm text-slate-400
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:bg-blue-600 file:text-white
            hover:file:bg-blue-500"
          />


          {file && (

            <p className="text-green-400 text-sm mt-4">
              Selected: {file.name}
            </p>

          )}

        </div>


        {/* Analyze Button */}

        <button
          onClick={analyzeCSV}
          disabled={loading}
          className="mt-6 px-6 py-3 rounded-lg
          font-semibold
          bg-blue-600
          hover:bg-blue-500
          disabled:bg-slate-700
          disabled:cursor-not-allowed
          transition"
        >

          {loading
            ? "Analyzing Network Traffic..."
            : "Analyze CSV"
          }

        </button>


        {/* Error */}

        {error && (

          <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">

            <p className="text-red-400 font-semibold">
              Analysis Error
            </p>

            <p className="text-red-300 text-sm mt-1">
              {error}
            </p>

          </div>

        )}


      </div>


      {/* ------------------------------------------------ */}
      {/* Results */}
      {/* ------------------------------------------------ */}

      {result && (

        <div className="mt-8">


          <h2 className="text-2xl font-semibold mb-6">
            Analysis Results
          </h2>


          {/* KPI Cards */}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">


            {/* Total */}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

              <p className="text-slate-400 text-sm">
                Records Analyzed
              </p>

              <p className="text-3xl font-bold mt-2">
                {result.total_records.toLocaleString()}
              </p>

            </div>


            {/* Threats */}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

              <p className="text-slate-400 text-sm">
                Threats Detected
              </p>

              <p className="text-3xl font-bold text-red-400 mt-2">
                {result.threat_records.toLocaleString()}
              </p>

            </div>


            {/* Benign */}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

              <p className="text-slate-400 text-sm">
                Benign Traffic
              </p>

              <p className="text-3xl font-bold text-green-400 mt-2">
                {result.benign_records.toLocaleString()}
              </p>

            </div>


            {/* Threat Percentage */}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

              <p className="text-slate-400 text-sm">
                Threat Percentage
              </p>

              <p className="text-3xl font-bold text-orange-400 mt-2">
                {result.threat_percentage}%
              </p>

            </div>

          </div>


          {/* ------------------------------------------------ */}
          {/* Attack Types */}
          {/* ------------------------------------------------ */}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">


            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

              <h3 className="text-xl font-semibold mb-5">
                Detected Attack Types
              </h3>


              {Object.entries(
                result.attack_types
              ).length === 0 ? (

                <p className="text-green-400">
                  No malicious traffic detected.
                </p>

              ) : (

                <div className="space-y-3">

                  {Object.entries(
                    result.attack_types
                  ).map(
                    ([attack, count]) => (

                      <div
                        key={attack}
                        className="flex justify-between
                        items-center
                        bg-slate-950
                        rounded-lg
                        p-4"
                      >

                        <span className="text-slate-300">
                          {attack}
                        </span>

                        <span className="font-semibold text-red-400">
                          {count.toLocaleString()}
                        </span>

                      </div>

                    )
                  )}

                </div>

              )}

            </div>


            {/* ------------------------------------------------ */}
            {/* Severity */}
            {/* ------------------------------------------------ */}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

              <h3 className="text-xl font-semibold mb-5">
                Severity Distribution
              </h3>


              <div className="space-y-3">

                {Object.entries(
                  result.severity_distribution
                ).map(
                  ([severity, count]) => (

                    <div
                      key={severity}
                      className="flex justify-between
                      items-center
                      bg-slate-950
                      rounded-lg
                      p-4"
                    >

                      <span
                        className={
                          severity === "CRITICAL"
                            ? "text-red-400 font-semibold"
                            : severity === "HIGH"
                            ? "text-orange-400 font-semibold"
                            : severity === "MEDIUM"
                            ? "text-yellow-400 font-semibold"
                            : "text-green-400 font-semibold"
                        }
                      >
                        {severity}
                      </span>


                      <span className="font-semibold">
                        {count.toLocaleString()}
                      </span>

                    </div>

                  )
                )}

              </div>

            </div>

          </div>


          {/* ------------------------------------------------ */}
          {/* Prediction Preview */}
          {/* ------------------------------------------------ */}

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-8">

            <h3 className="text-xl font-semibold mb-5">
              Prediction Preview
            </h3>


            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead>

                  <tr className="border-b border-slate-800">

                    <th className="text-left p-3 text-slate-400">
                      Prediction
                    </th>

                    <th className="text-left p-3 text-slate-400">
                      Confidence
                    </th>

                    <th className="text-left p-3 text-slate-400">
                      Risk Score
                    </th>

                    <th className="text-left p-3 text-slate-400">
                      Severity
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {result.results_preview.map(
                    (row, index) => (

                      <tr
                        key={index}
                        className="border-b border-slate-800"
                      >

                        <td className="p-3">
                          {row.Prediction}
                        </td>

                        <td className="p-3">
                          {(row.Confidence * 100).toFixed(2)}%
                        </td>

                        <td className="p-3">
                          {row["Risk Score"]}/100
                        </td>

                        <td
                          className={
                            row.Severity === "CRITICAL"
                              ? "p-3 text-red-400 font-semibold"
                              : row.Severity === "HIGH"
                              ? "p-3 text-orange-400 font-semibold"
                              : row.Severity === "MEDIUM"
                              ? "p-3 text-yellow-400 font-semibold"
                              : "p-3 text-green-400 font-semibold"
                          }
                        >
                          {row.Severity}
                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>


            <p className="text-slate-500 text-xs mt-4">
              Showing the first 100 predictions.
            </p>

          </div>


        </div>

      )}

    </div>

  );
}

export default ThreatDetection;