"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Brain, 
  Activity, 
  Newspaper, 
  BarChart3, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ExternalLink,
  BookOpen,
  DollarSign
} from "lucide-react";

// Define Step structures
interface StepState {
  id: number;
  title: string;
  desc: string;
  status: "pending" | "running" | "completed" | "failed";
  icon: React.ComponentType<any>;
}

// Define Tool Log structures
interface ToolLog {
  id: string;
  timestamp: string;
  tag: "tavily" | "fmp" | "agent" | "system";
  message: string;
}

// Define Verdict structure
interface VerdictData {
  company: string;
  symbol: string;
  verdict: "invest" | "pass" | "error";
  confidence: number;
  reasoning: string;
  bullCase: string[];
  bearCase: string[];
  risks: string[];
  sources: string[];
}

interface RawLogItem {
  id: string;
  timestamp: string;
  tool: string;
  type: "call" | "result";
  content: string;
  expanded?: boolean;
}

const QUICK_COMPANIES = ["Infosys", "Tata Motors", "Tesla", "Reliance Industries", "Nvidia"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [confidenceWidth, setConfidenceWidth] = useState(0);
  
  // Terminal logs state
  const [logs, setLogs] = useState<ToolLog[]>([]);
  const [rawLogs, setRawLogs] = useState<RawLogItem[]>([]);
  const [showRawLogs, setShowRawLogs] = useState(false);

  // Pipeline steps state
  const [steps, setSteps] = useState<StepState[]>([
    { id: 1, title: "Symbol Resolution", desc: "Resolving company name to stock ticker symbol", status: "pending", icon: Search },
    { id: 2, title: "Financial Analysis", desc: "Retrieving consolidated financial statements", status: "pending", icon: BarChart3 },
    { id: 3, title: "Sentiment & News", desc: "Researching market news and competitor landscape", status: "pending", icon: Newspaper },
    { id: 4, title: "Investment Synthesis", desc: "Analyzing data points to formulate final verdict", status: "pending", icon: Brain },
  ]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs terminal
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, []);

  const cleanupConnection = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const addLog = (tag: "tavily" | "fmp" | "agent" | "system", message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { id: Math.random().toString(), timestamp, tag, message }]);
  };

  const updateStepStatus = (stepId: number, status: "pending" | "running" | "completed" | "failed") => {
    setSteps((prevSteps) =>
      prevSteps.map((step) => {
        // Auto-complete preceding steps if we move forward
        if (step.id < stepId && status === "running" && step.status !== "completed") {
          return { ...step, status: "completed" };
        }
        if (step.id === stepId) {
          return { ...step, status };
        }
        return step;
      })
    );
  };

  const startAnalysis = (targetCompany: string) => {
    if (!targetCompany.trim()) return;

    cleanupConnection();
    setLoading(true);
    setError(null);
    setVerdict(null);
    setConfidenceWidth(0);
    setLogs([]);
    setRawLogs([]);
    setElapsedTime(0);
    
    // Reset steps to pending
    setSteps((prev) => prev.map((s) => ({ ...s, status: "pending" })));

    addLog("system", `Initializing analysis request for: "${targetCompany}"`);
    updateStepStatus(1, "running");

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const sseUrl = `/api/analyze?company=${encodeURIComponent(targetCompany)}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        switch (payload.type) {
          case "step_start":
            if (payload.step === 1) {
              updateStepStatus(1, "running");
              addLog("agent", "Step 1: Commencing company search and symbol resolution.");
            } else if (payload.step === 2) {
              updateStepStatus(2, "running");
              addLog("agent", "Step 2: Commencing financial statement retrieval.");
            } else if (payload.step === 3) {
              // Final synthesis starts
              updateStepStatus(3, "completed");
              updateStepStatus(4, "running");
              addLog("agent", "Step 4: Commencing final investment reasoning synthesis.");
            }
            break;

          case "step_done":
            if (payload.step === 1) {
              updateStepStatus(1, "completed");
            } else if (payload.step === 2) {
              updateStepStatus(2, "completed");
              updateStepStatus(3, "running");
              addLog("agent", "Step 3: Commencing news sentiment and qualitative research.");
            } else if (payload.step === 3) {
              updateStepStatus(4, "completed");
            }
            break;

          case "tool_call":
            const toolArgs = JSON.parse(payload.input);
            if (payload.tool === "tavily_search") {
              addLog("tavily", `Invoking Tavily Search with query: "${toolArgs.query}"`);
            } else if (payload.tool === "fmp_financials") {
              addLog("fmp", `Invoking Financial Modeling Prep (FMP) for stock ticker symbol: "${toolArgs.symbol}"`);
            }
            setRawLogs((prev) => [
              ...prev,
              {
                id: Math.random().toString(),
                timestamp: new Date().toLocaleTimeString(),
                tool: payload.tool,
                type: "call",
                content: payload.input,
              },
            ]);
            break;

          case "tool_result":
            if (payload.tool === "tavily_search") {
              addLog("tavily", `Search completed successfully. Returning news feed payload.`);
            } else if (payload.tool === "fmp_financials") {
              addLog("fmp", `Financial data retrieved successfully.`);
            }
            setRawLogs((prev) => [
              ...prev,
              {
                id: Math.random().toString(),
                timestamp: new Date().toLocaleTimeString(),
                tool: payload.tool,
                type: "result",
                content: payload.output || payload.summary || "No raw data returned.",
              },
            ]);
            break;

          case "verdict":
            setVerdict(payload.data);
            addLog("system", "Final structured verdict compiled successfully.");
            
            // Trigger animated confidence progress bar with 50ms delay
            setTimeout(() => {
              setConfidenceWidth(payload.data.confidence);
            }, 50);
            break;

          case "done":
            addLog("system", "Stream finished. Analysis complete.");
            setLoading(false);
            cleanupConnection();
            break;

          case "error":
            setError(payload.message || "An error occurred during agent analysis.");
            addLog("system", `ERROR: ${payload.message}`);
            setLoading(false);
            cleanupConnection();
            // Mark running steps as failed
            setSteps((prev) =>
              prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s))
            );
            break;
        }
      } catch (err: any) {
        console.error("Failed to parse SSE payload:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource error:", err);
      setError("Failed to connect to the analysis stream. Please try again.");
      addLog("system", "Connection interrupted or server error occurred.");
      setLoading(false);
      cleanupConnection();
      setSteps((prev) =>
        prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s))
      );
    };
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startAnalysis(query);
  };

  const handleCompanyClick = (companyName: string) => {
    setQuery(companyName);
    startAnalysis(companyName);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[300px] right-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-900 pb-6 mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
              <TrendingUp className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 via-indigo-100 to-violet-300 bg-clip-text text-transparent">
                Altuni AI Labs
              </h1>
              <p className="text-xs text-slate-400 font-medium tracking-wider uppercase">
                AI Investment Research Agent
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/SuryaPranav2k5/AI-Investment-Research-Agent"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1.5 border border-slate-900 bg-slate-950 px-3 py-1.5 rounded-lg"
            >
              GitHub Repository <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </header>

        {/* Search & Suggestions Card */}
        <section className="mb-8 bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-md shadow-xl">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter company name (e.g. Nvidia, Tesla, Tata Motors...)"
                disabled={loading}
                className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 transition-all disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Activity className="w-5 h-5" />
                  Analyze Company
                </>
              )}
            </button>
          </form>

          {/* Quick-test templates */}
          <div className="flex flex-wrap items-center gap-2.5 mt-4 pt-4 border-t border-slate-900/60">
            <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase mr-1">
              Quick Test:
            </span>
            {QUICK_COMPANIES.map((companyName) => (
              <button
                key={companyName}
                type="button"
                onClick={() => handleCompanyClick(companyName)}
                disabled={loading}
                className="text-xs px-3 py-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-300 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {companyName}
              </button>
            ))}
          </div>
        </section>

        {/* Dashboard Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Agent Activity Panel (5 cols) */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Steps checklist card */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-md shadow-xl flex-1">
              <div className="flex items-center justify-between border-b border-slate-900/80 pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-md font-semibold text-slate-200">
                    Agent Activity Logs
                  </h2>
                </div>
                {loading && (
                  <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full text-xs font-medium">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
                    Running • {elapsedTime}s
                  </div>
                )}
              </div>

              {/* Steps timeline */}
              <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-6">
                {steps.map((step) => {
                  const StepIcon = step.icon;
                  const isPending = step.status === "pending";
                  const isRunning = step.status === "running";
                  const isCompleted = step.status === "completed";
                  const isFailed = step.status === "failed";

                  return (
                    <div key={step.id} className="relative">
                      {/* Step Indicator Dot */}
                      <span className="absolute -left-[35px] top-0.5 flex h-6.5 w-6.5 items-center justify-center rounded-full bg-slate-950 border transition-all">
                        {isCompleted && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 bg-slate-950 rounded-full" />
                        )}
                        {isRunning && (
                          <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                        )}
                        {isPending && (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        )}
                        {isFailed && (
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        )}
                      </span>

                      <div>
                        <h3 className={`text-sm font-semibold flex items-center gap-2 ${
                          isCompleted ? "text-slate-100" : isRunning ? "text-indigo-400" : "text-slate-500"
                        }`}>
                          <StepIcon className={`w-4 h-4 ${isRunning ? "animate-pulse" : ""}`} />
                          {step.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Terminal logs card */}
            <div className="bg-slate-950 border border-slate-900 rounded-2xl p-4 shadow-xl flex flex-col h-[280px]">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-slate-400 font-mono ml-2">
                  terminal_console.sh
                </span>
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-4 text-slate-300 space-y-1 pr-1 custom-scrollbar">
                {logs.length === 0 ? (
                  <div className="text-slate-600 text-center py-16">
                    Waiting for agent execution logs...
                  </div>
                ) : (
                  logs.map((log) => {
                    const tagColors = {
                      tavily: "text-blue-400",
                      fmp: "text-amber-400",
                      agent: "text-indigo-400",
                      system: "text-purple-400",
                    };
                    return (
                      <div key={log.id} className="hover:bg-slate-900/30 p-0.5 rounded transition-all">
                        <span className="text-slate-600">[{log.timestamp}]</span>{" "}
                        <span className={`font-bold ${tagColors[log.tag]}`}>
                          [{log.tag}]
                        </span>{" "}
                        <span>{log.message}</span>
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </section>

          {/* Right Column: Investment Verdict (7 cols) */}
          <section className="lg:col-span-7">
            
            {/* Error display */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-6 rounded-2xl backdrop-blur-md mb-6 shadow-xl flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-rose-200">Analysis Error</h3>
                  <p className="text-sm text-rose-300/80 mt-1 leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* Empty State / Welcome Screen */}
            {!loading && !verdict && !error && (
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-10 backdrop-blur-md shadow-xl text-center flex flex-col items-center justify-center min-h-[460px]">
                <div className="p-4 bg-indigo-500/10 rounded-full border border-indigo-500/20 mb-6 animate-pulse">
                  <Brain className="w-12 h-12 text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-100">
                  Ready to Research
                </h2>
                <p className="text-sm text-slate-400 max-w-md mt-2 leading-relaxed">
                  Enter any company name or select a quick test template to begin real-time qualitative and quantitative investment analysis.
                </p>
                <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-sm text-left">
                  <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-900">
                    <span className="text-indigo-400 text-xs font-bold font-mono">STEP 1-2</span>
                    <p className="text-xs text-slate-300 mt-1">Ticker resolution & financials check</p>
                  </div>
                  <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-900">
                    <span className="text-indigo-400 text-xs font-bold font-mono">STEP 3-4</span>
                    <p className="text-xs text-slate-300 mt-1">Sentiment news search & final synthesis</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading skeleton loader */}
            {loading && !verdict && (
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-8 backdrop-blur-md shadow-xl flex flex-col min-h-[460px]">
                <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
                  <div className="flex items-center gap-3 w-1/2">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl animate-pulse" />
                    <div className="w-3/4 h-5 bg-slate-800 rounded animate-pulse" />
                  </div>
                  <div className="w-20 h-8 bg-slate-800 rounded-lg animate-pulse" />
                </div>
                <div className="space-y-4 flex-1">
                  <div className="h-4 bg-slate-800 rounded w-1/3 animate-pulse" />
                  <div className="h-20 bg-slate-800 rounded w-full animate-pulse" />
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="h-32 bg-slate-800 rounded animate-pulse" />
                    <div className="h-32 bg-slate-800 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            )}

            {/* Verdict Result Card */}
            {verdict && (
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-md shadow-xl flex flex-col gap-6 animate-fade-in">
                
                {/* Header Card Info */}
                <div className="flex items-center justify-between border-b border-slate-900 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                      <BookOpen className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-100">
                        {verdict.company}
                      </h2>
                      <p className="text-xs text-indigo-400 font-semibold tracking-wide">
                        Stock symbol: {verdict.symbol}
                      </p>
                    </div>
                  </div>

                  {/* Verdict Badge */}
                  {verdict.verdict === "invest" ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold tracking-wider uppercase shadow-lg shadow-emerald-500/5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Invest
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold tracking-wider uppercase shadow-lg shadow-rose-500/5">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Pass
                    </span>
                  )}
                </div>

                {/* Confidence Score Bar */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Confidence Indicator
                    </span>
                    <span className={`text-xs font-bold font-mono ${
                      verdict.confidence >= 75 ? "text-emerald-400" : verdict.confidence >= 50 ? "text-amber-400" : "text-rose-400"
                    }`}>
                      {verdict.confidence}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-950 border border-slate-800/80 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${confidenceWidth}%` }}
                      className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${
                        verdict.verdict === "invest" ? "from-indigo-500 to-emerald-500" : "from-indigo-500 to-rose-500"
                      }`}
                    />
                  </div>
                </div>

                {/* Reasoning summary text */}
                <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-4.5">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Verdict Reasoning Summary
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {verdict.reasoning}
                  </p>
                </div>

                {/* Bull vs Bear Case Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bull Case */}
                  <div className="bg-emerald-500/[0.02] border border-emerald-500/10 rounded-xl p-4 flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Bull Case Catalysts
                    </h3>
                    <ul className="text-xs text-slate-300 space-y-2 flex-1">
                      {verdict.bullCase?.map((bull, i) => (
                        <li key={i} className="flex gap-2 items-start leading-relaxed">
                          <span className="text-emerald-500/80 select-none mt-0.5">•</span>
                          {bull}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Bear Case */}
                  <div className="bg-rose-500/[0.02] border border-rose-500/10 rounded-xl p-4 flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Bear Case Risks
                    </h3>
                    <ul className="text-xs text-slate-300 space-y-2 flex-1">
                      {verdict.bearCase?.map((bear, i) => (
                        <li key={i} className="flex gap-2 items-start leading-relaxed">
                          <span className="text-rose-500/80 select-none mt-0.5">•</span>
                          {bear}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Risks details */}
                {verdict.risks && verdict.risks.length > 0 && (
                  <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
                      Identified Risk Analysis
                    </h4>
                    <ul className="text-xs text-slate-300 space-y-2">
                      {verdict.risks.map((risk, i) => (
                        <li key={i} className="flex gap-2 items-start leading-relaxed">
                          <span className="text-indigo-500/80 select-none">•</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sources list */}
                {verdict.sources && verdict.sources.length > 0 && (
                  <div className="border-t border-slate-900 pt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
                      Sources Cited:
                    </span>
                    {verdict.sources.map((source, i) => {
                      const isUrl = source.startsWith("http://") || source.startsWith("https://");
                      if (isUrl) {
                        // Extract domain name
                        let domain = source;
                        try {
                          domain = new URL(source).hostname;
                        } catch {}
                        return (
                          <a
                            key={i}
                            href={source}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2.5 py-1 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg flex items-center gap-1 transition-colors"
                          >
                            {domain} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        );
                      }
                      return (
                        <span
                          key={i}
                          className="text-xs px-2.5 py-1 bg-slate-950/40 border border-slate-900 text-slate-400 rounded-lg"
                        >
                          {source}
                        </span>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

          </section>

        </div>

        {/* Raw Developer Logs Collapsible Inspector */}
        <section className="mt-12 bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl transition-all">
          {/* Header Toggle Button */}
          <button
            type="button"
            onClick={() => setShowRawLogs(!showRawLogs)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-900/40 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-200">Raw Tool Execution Logs</h3>
                <p className="text-xs text-slate-500 font-mono">inspect_payloads.sh</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-950 border border-slate-800 text-slate-400 rounded-md font-mono">
                {rawLogs.length} events
              </span>
              {showRawLogs ? (
                <span className="text-slate-400 text-xs">▲ Hide Logs</span>
              ) : (
                <span className="text-slate-400 text-xs">▼ Show Logs</span>
              )}
            </div>
          </button>

          {/* Expanded Content */}
          {showRawLogs && (
            <div className="border-t border-slate-900/60 p-6 bg-slate-950/40">
              {rawLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-600 font-mono">
                  No active tools execution trace recorded. Enter a company to start analysis.
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2 font-mono text-xs">
                  {rawLogs.map((log) => {
                    const isCall = log.type === "call";
                    const displayContent = log.expanded || log.content.length <= 500
                      ? log.content
                      : `${log.content.slice(0, 500)}...`;

                    return (
                      <div
                        key={log.id}
                        className={`p-4 rounded-xl border ${
                          isCall
                            ? "bg-indigo-950/10 border-indigo-900/30 text-indigo-200"
                            : "bg-slate-950/60 border-slate-900/60 text-slate-300"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-900 pb-2 mb-2 gap-1 text-[11px] font-bold">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">[{log.timestamp}]</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                              isCall ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            }`}>
                              {log.type}
                            </span>
                            <span className="text-slate-300 font-semibold">{log.tool}</span>
                          </div>
                        </div>

                        {/* Content Box */}
                        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-900 overflow-x-auto max-h-72">
                          {displayContent}
                        </pre>

                        {/* Show More / Show Less Toggle Button */}
                        {log.content.length > 500 && (
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setRawLogs((prev) =>
                                  prev.map((item) =>
                                    item.id === log.id ? { ...item, expanded: !item.expanded } : item
                                  )
                                );
                              }}
                              className="text-[10px] px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30 rounded-md transition-all font-semibold active:scale-95"
                            >
                              {log.expanded ? "Show Less" : `Show More (${(log.content.length - 500)} chars hidden)`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
