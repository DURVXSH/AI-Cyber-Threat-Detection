import { useState } from "react";

import Dashboard from "./components/Dashboard";
import ThreatDetection from "./components/ThreatDetection";
import ThreatHistory from "./components/ThreatHistory";
import Explainability from "./components/Explainability";
import ModelPerformance from "./components/ModelPerformance";
import ConfusionMatrix from "./components/ConfusionMatrix";


function App() {

  const [activePage, setActivePage] = useState("dashboard");


  const navigation = [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: "▣"
    },
    {
      id: "detection",
      name: "Threat Detection",
      icon: "◉"
    },
    {
      id: "history",
      name: "Threat History",
      icon: "☷"
    },
    {
     id: "explainability",
     name: "Explainable AI",
    icon: "✳"
    },
    {
      id: "performance",
      name: "Model Performance",
      icon: "▥"
    },
    { id: "confusion", name: "Confusion Matrix", icon: "▦" },
  ];


  const renderPage = () => {

    if (activePage === "dashboard") {
      return <Dashboard />;
    }

    if (activePage === "detection") {
      return <ThreatDetection />;
    }

    if (activePage === "history") {
      return <ThreatHistory />;
    }
    if (activePage === "explainability") {
      return <Explainability />;
    }
    if (activePage === "performance") {
     return <ModelPerformance />;
    }
   if (activePage === "confusion") {
      return <ConfusionMatrix />;
    }
    return <Dashboard />;
  };


  return (

    <div className="min-h-screen bg-slate-950 text-white flex">


      {/* ========================================= */}
      {/* SIDEBAR */}
      {/* ========================================= */}

      <aside className="w-64 min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col">


        {/* LOGO */}

        <div className="px-6 py-6 border-b border-slate-800">

          <div className="flex items-center gap-3">

            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-xl">

              🛡️

            </div>


            <div>

              <h1 className="font-bold text-sm">
                AI Cyber
              </h1>

              <p className="text-xs text-slate-400">
                Threat Detection
              </p>

            </div>

          </div>

        </div>


        {/* NAVIGATION */}

        <nav className="flex-1 px-3 py-6">

          <p className="px-3 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">

            Monitoring

          </p>


          <div className="space-y-2">

            {navigation.map((item) => (

              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`
                  w-full flex items-center gap-3
                  px-4 py-3 rounded-lg
                  text-sm font-medium
                  transition-all duration-200
                  text-left
                  ${
                    activePage === item.id
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }
                `}
              >

                <span className="text-lg w-5 text-center">
                  {item.icon}
                </span>

                <span>
                  {item.name}
                </span>

              </button>

            ))}

          </div>

        </nav>


        {/* MODEL STATUS */}

        <div className="p-4">

          <div className="rounded-xl bg-slate-800/70 border border-slate-700 p-4">

            <div className="flex items-center gap-2 mb-2">

              <span className="relative flex h-2.5 w-2.5">

                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping"></span>

                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>

              </span>

              <span className="text-xs font-medium text-green-400">
                AI Engine Online
              </span>

            </div>


            <p className="text-xs text-slate-500">
              XGBoost • CIC-IDS2017
            </p>

          </div>

        </div>


      </aside>


      {/* ========================================= */}
      {/* MAIN CONTENT */}
      {/* ========================================= */}

      <main className="flex-1 min-w-0">

        {/* TOP BAR */}

        <header className="h-16 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between px-6">

          <div>

            <p className="text-sm text-slate-400">

              Security Operations Center

            </p>

          </div>


          <div className="flex items-center gap-3">

            <div className="w-2 h-2 rounded-full bg-green-500"></div>

            <span className="text-sm text-slate-400">
              API Online
            </span>

          </div>

        </header>


        {/* PAGE */}

        <div className="min-h-[calc(100vh-4rem)]">

          {renderPage()}

        </div>


      </main>


    </div>

  );

}


export default App;