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
  DollarSign,
  RotateCcw
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
  prefix?: string;
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
  prefix?: string;
}

const QUICK_COMPANIES = ["Infosys", "Tata Motors", "Tesla", "Reliance Industries", "Nvidia"];

export default function Home() {
  const [mode, setMode] = useState<"single" | "compare">("single");

  // Single Mode states
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [confidenceWidth, setConfidenceWidth] = useState(0);
  
  // Compare Mode states
  const [queryA, setQueryA] = useState("");
  const [queryB, setQueryB] = useState("");
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);
  const [elapsedTimeA, setElapsedTimeA] = useState(0);
  const [elapsedTimeB, setElapsedTimeB] = useState(0);
  const [verdictA, setVerdictA] = useState<VerdictData | null>(null);
  const [verdictB, setVerdictB] = useState<VerdictData | null>(null);
  const [confidenceWidthA, setConfidenceWidthA] = useState(0);
  const [confidenceWidthB, setConfidenceWidthB] = useState(0);

  // Terminal logs state (consolidated)
  const [logs, setLogs] = useState<ToolLog[]>([]);
  const [rawLogs, setRawLogs] = useState<RawLogItem[]>([]);
  const [showRawLogs, setShowRawLogs] = useState(false);

  // Pipeline steps states
  const [steps, setSteps] = useState<StepState[]>([
    { id: 1, title: "Symbol Resolution", desc: "Resolving company name to stock ticker symbol", status: "pending", icon: Search },
    { id: 2, title: "Financial Analysis", desc: "Retrieving consolidated financial statements", status: "pending", icon: BarChart3 },
    { id: 3, title: "Sentiment & News", desc: "Researching market news and competitor landscape", status: "pending", icon: Newspaper },
    { id: 4, title: "Investment Synthesis", desc: "Analyzing data points to formulate final verdict", status: "pending", icon: Brain },
  ]);

  const [stepsA, setStepsA] = useState<StepState[]>([
    { id: 1, title: "Symbol Resolution", desc: "Resolving company name to stock ticker symbol", status: "pending", icon: Search },
    { id: 2, title: "Financial Analysis", desc: "Retrieving consolidated financial statements", status: "pending", icon: BarChart3 },
    { id: 3, title: "Sentiment & News", desc: "Researching market news and competitor landscape", status: "pending", icon: Newspaper },
    { id: 4, title: "Investment Synthesis", desc: "Analyzing data points to formulate final verdict", status: "pending", icon: Brain },
  ]);

  const [stepsB, setStepsB] = useState<StepState[]>([
    { id: 1, title: "Symbol Resolution", desc: "Resolving company name to stock ticker symbol", status: "pending", icon: Search },
    { id: 2, title: "Financial Analysis", desc: "Retrieving consolidated financial statements", status: "pending", icon: BarChart3 },
    { id: 3, title: "Sentiment & News", desc: "Researching market news and competitor landscape", status: "pending", icon: Newspaper },
    { id: 4, title: "Investment Synthesis", desc: "Analyzing data points to formulate final verdict", status: "pending", icon: Brain },
  ]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const eventSourceRefA = useRef<EventSource | null>(null);
  const eventSourceRefB = useRef<EventSource | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerRefA = useRef<NodeJS.Timeout | null>(null);
  const timerRefB = useRef<NodeJS.Timeout | null>(null);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs terminal
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupConnection("all");
    };
  }, []);

  const cleanupConnection = (target: "single" | "A" | "B" | "all") => {
    if (target === "single" || target === "all") {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    if (target === "A" || target === "all") {
      if (eventSourceRefA.current) {
        eventSourceRefA.current.close();
        eventSourceRefA.current = null;
      }
      if (timerRefA.current) {
        clearInterval(timerRefA.current);
        timerRefA.current = null;
      }
    }
    if (target === "B" || target === "all") {
      if (eventSourceRefB.current) {
        eventSourceRefB.current.close();
        eventSourceRefB.current = null;
      }
      if (timerRefB.current) {
        clearInterval(timerRefB.current);
        timerRefB.current = null;
      }
    }
  };

  const addLog = (tag: "tavily" | "fmp" | "agent" | "system", message: string, prefix?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { id: Math.random().toString(), timestamp, tag, message, prefix }]);
  };

  const updateStepStatus = (
    target: "single" | "A" | "B",
    stepId: number,
    status: "pending" | "running" | "completed" | "failed"
  ) => {
    const setter = target === "single" ? setSteps : target === "A" ? setStepsA : setStepsB;
    setter((prevSteps) =>
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

  const startStream = (targetCompany: string, targetKey: "single" | "A" | "B") => {
    if (!targetCompany.trim()) return;

    cleanupConnection(targetKey);

    if (targetKey === "single") {
      setLoading(true);
      setError(null);
      setVerdict(null);
      setConfidenceWidth(0);
      setElapsedTime(0);
      setSteps((prev) => prev.map((s) => ({ ...s, status: "pending" })));
    } else if (targetKey === "A") {
      setLoadingA(true);
      setErrorA(null);
      setVerdictA(null);
      setConfidenceWidthA(0);
      setElapsedTimeA(0);
      setStepsA((prev) => prev.map((s) => ({ ...s, status: "pending" })));
    } else {
      setLoadingB(true);
      setErrorB(null);
      setVerdictB(null);
      setConfidenceWidthB(0);
      setElapsedTimeB(0);
      setStepsB((prev) => prev.map((s) => ({ ...s, status: "pending" })));
    }

    const logPrefix = targetKey === "single" ? undefined : targetKey;
    addLog("system", `Initializing analysis request for: "${targetCompany}"`, logPrefix);
    updateStepStatus(targetKey, 1, "running");

    const startTime = Date.now();
    const timer = setInterval(() => {
      const delta = Math.floor((Date.now() - startTime) / 1000);
      if (targetKey === "single") {
        setElapsedTime(delta);
      } else if (targetKey === "A") {
        setElapsedTimeA(delta);
      } else {
        setElapsedTimeB(delta);
      }
    }, 1000);

    if (targetKey === "single") {
      timerRef.current = timer;
    } else if (targetKey === "A") {
      timerRefA.current = timer;
    } else {
      timerRefB.current = timer;
    }

    const sseUrl = `/api/analyze?company=${encodeURIComponent(targetCompany)}`;
    const eventSource = new EventSource(sseUrl);

    if (targetKey === "single") {
      eventSourceRef.current = eventSource;
    } else if (targetKey === "A") {
      eventSourceRefA.current = eventSource;
    } else {
      eventSourceRefB.current = eventSource;
    }

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        switch (payload.type) {
          case "step_start":
            if (payload.step === 1) {
              updateStepStatus(targetKey, 1, "running");
              addLog("agent", "Step 1: Commencing company search and symbol resolution.", logPrefix);
            } else if (payload.step === 2) {
              updateStepStatus(targetKey, 2, "running");
              addLog("agent", "Step 2: Commencing financial statement retrieval.", logPrefix);
            } else if (payload.step === 3) {
              updateStepStatus(targetKey, 3, "completed");
              updateStepStatus(targetKey, 4, "running");
              addLog("agent", "Step 4: Commencing final investment reasoning synthesis.", logPrefix);
            }
            break;

          case "step_done":
            if (payload.step === 1) {
              updateStepStatus(targetKey, 1, "completed");
            } else if (payload.step === 2) {
              updateStepStatus(targetKey, 2, "completed");
              updateStepStatus(targetKey, 3, "running");
              addLog("agent", "Step 3: Commencing news sentiment and qualitative research.", logPrefix);
            } else if (payload.step === 3) {
              updateStepStatus(targetKey, 4, "completed");
            }
            break;

          case "tool_call":
            const toolArgs = JSON.parse(payload.input);
            if (payload.tool === "tavily_search") {
              addLog("tavily", `Invoking Tavily Search with query: "${toolArgs.query}"`, logPrefix);
            } else if (payload.tool === "fmp_financials") {
              addLog("fmp", `Invoking Financial Modeling Prep (FMP) for stock ticker symbol: "${toolArgs.symbol}"`, logPrefix);
            }
            setRawLogs((prev) => [
              ...prev,
              {
                id: Math.random().toString(),
                timestamp: new Date().toLocaleTimeString(),
                tool: payload.tool,
                type: "call",
                content: payload.input,
                prefix: logPrefix,
              },
            ]);
            break;

          case "tool_result":
            if (payload.tool === "tavily_search") {
              addLog("tavily", `Search completed successfully. Returning news feed payload.`, logPrefix);
            } else if (payload.tool === "fmp_financials") {
              addLog("fmp", `Financial data retrieved successfully.`, logPrefix);
            }
            setRawLogs((prev) => [
              ...prev,
              {
                id: Math.random().toString(),
                timestamp: new Date().toLocaleTimeString(),
                tool: payload.tool,
                type: "result",
                content: payload.output || payload.summary || "No raw data returned.",
                prefix: logPrefix,
              },
            ]);
            break;

          case "verdict":
            if (targetKey === "single") {
              setVerdict(payload.data);
              setTimeout(() => {
                setConfidenceWidth(payload.data.confidence);
              }, 50);
            } else if (targetKey === "A") {
              setVerdictA(payload.data);
              setTimeout(() => {
                setConfidenceWidthA(payload.data.confidence);
              }, 50);
            } else {
              setVerdictB(payload.data);
              setTimeout(() => {
                setConfidenceWidthB(payload.data.confidence);
              }, 50);
            }
            addLog("system", `Final structured verdict compiled successfully for ${payload.data.company}.`, logPrefix);
            break;

          case "done":
            addLog("system", `Stream finished. Analysis complete for ${targetCompany}.`, logPrefix);
            if (targetKey === "single") {
              setLoading(false);
            } else if (targetKey === "A") {
              setLoadingA(false);
            } else {
              setLoadingB(false);
            }
            cleanupConnection(targetKey);
            break;

          case "error":
            const errorMsg = payload.message || "An error occurred during agent analysis.";
            addLog("system", `ERROR: ${errorMsg}`, logPrefix);
            if (targetKey === "single") {
              setError(errorMsg);
              setLoading(false);
            } else if (targetKey === "A") {
              setErrorA(errorMsg);
              setLoadingA(false);
            } else {
              setErrorB(errorMsg);
              setLoadingB(false);
            }
            cleanupConnection(targetKey);
            // Mark running steps as failed
            if (targetKey === "single") {
              setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)));
            } else if (targetKey === "A") {
              setStepsA((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)));
            } else {
              setStepsB((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)));
            }
            break;
        }
      } catch (err: any) {
        console.error("Failed to parse SSE payload:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource error:", err);
      const connectionError = "Failed to connect to the analysis stream. Please try again.";
      addLog("system", "Connection interrupted or server error occurred.", logPrefix);
      if (targetKey === "single") {
        setError(connectionError);
        setLoading(false);
      } else if (targetKey === "A") {
        setErrorA(connectionError);
        setLoadingA(false);
      } else {
        setErrorB(connectionError);
        setLoadingB(false);
      }
      cleanupConnection(targetKey);
      if (targetKey === "single") {
        setSteps((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)));
      } else if (targetKey === "A") {
        setStepsA((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)));
      } else {
        setStepsB((prev) => prev.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)));
      }
    };
  };

  const startAnalysis = (targetCompany: string) => {
    setLogs([]);
    setRawLogs([]);
    startStream(targetCompany, "single");
  };

  const startComparison = (companyA: string, companyB: string) => {
    if (!companyA.trim() || !companyB.trim()) return;
    setLogs([]);
    setRawLogs([]);
    startStream(companyA, "A");
    startStream(companyB, "B");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startAnalysis(query);
  };

  const handleCompanyClick = (companyName: string) => {
    setQuery(companyName);
    startAnalysis(companyName);
  };

  const COMPARE_PAIRS = [
    { label: "Tesla vs. Nvidia", a: "Tesla", b: "Nvidia" },
    { label: "Infosys vs. Tata Motors", a: "Infosys", b: "Tata Motors" },
    { label: "Apple vs. Microsoft", a: "Apple", b: "Microsoft" }
  ];

  const renderComparisonMatrix = (vA: VerdictData, vB: VerdictData) => {
    return (
      <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-md shadow-xl mb-8">
        <h3 className="text-lg font-bold text-slate-100 mb-4 bg-gradient-to-r from-indigo-200 to-violet-300 bg-clip-text text-transparent">
          Comparison Summary Matrix
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Metric</th>
                <th className="py-3 px-4 text-xs font-semibold text-pink-400 uppercase tracking-wider bg-pink-500/5">
                  [A] {vA.company}
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-cyan-400 uppercase tracking-wider bg-cyan-500/5">
                  [B] {vB.company}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-sm">
              <tr className="hover:bg-slate-900/20">
                <td className="py-3 px-4 font-medium text-slate-300">Ticker Symbol</td>
                <td className="py-3 px-4 font-mono text-pink-400 bg-pink-500/[0.01]">{vA.symbol}</td>
                <td className="py-3 px-4 font-mono text-cyan-400 bg-cyan-500/[0.01]">{vB.symbol}</td>
              </tr>
              <tr className="hover:bg-slate-900/20">
                <td className="py-3 px-4 font-medium text-slate-300">AI Research Verdict</td>
                <td className="py-3 px-4 bg-pink-500/[0.01]">
                  {vA.verdict === "invest" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold uppercase">
                      Invest
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-bold uppercase">
                      Pass
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 bg-cyan-500/[0.01]">
                  {vB.verdict === "invest" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold uppercase">
                      Invest
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs font-bold uppercase">
                      Pass
                    </span>
                  )}
                </td>
              </tr>
              <tr className="hover:bg-slate-900/20">
                <td className="py-3 px-4 font-medium text-slate-300">Confidence Score</td>
                <td className="py-3 px-4 bg-pink-500/[0.01]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{vA.confidence}%</span>
                    <div className="w-24 h-1.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${vA.confidence}%` }} />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 bg-cyan-500/[0.01]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{vB.confidence}%</span>
                    <div className="w-24 h-1.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${vB.confidence}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-slate-900/20">
                <td className="py-3 px-4 font-medium text-slate-300">Bull Catalysts</td>
                <td className="py-3 px-4 text-emerald-400 bg-pink-500/[0.01] font-medium">{vA.bullCase?.length || 0} items</td>
                <td className="py-3 px-4 text-emerald-400 bg-cyan-500/[0.01] font-medium">{vB.bullCase?.length || 0} items</td>
              </tr>
              <tr className="hover:bg-slate-900/20">
                <td className="py-3 px-4 font-medium text-slate-300">Risk Factors</td>
                <td className="py-3 px-4 text-rose-400 bg-pink-500/[0.01] font-medium">{(vA.bearCase?.length || 0) + (vA.risks?.length || 0)} items</td>
                <td className="py-3 px-4 text-rose-400 bg-cyan-500/[0.01] font-medium">{(vB.bearCase?.length || 0) + (vB.risks?.length || 0)} items</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderVerdictCard = (
    verdictData: VerdictData,
    confidenceWidthVal: number,
    prefixKey: "A" | "B" | "single"
  ) => {
    const isInvest = verdictData.verdict === "invest";
    
    return (
      <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-md shadow-xl flex flex-col gap-6 animate-fade-in">
        {/* Header Card Info */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <BookOpen className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                {prefixKey !== "single" && (
                  <span className={`font-mono text-xs font-bold ${prefixKey === "A" ? "bg-pink-400/10 border-pink-400/20 text-pink-400" : "bg-cyan-400/10 border-cyan-400/20 text-cyan-400"} border px-1.5 py-0.5 rounded`}>
                    {prefixKey}
                  </span>
                )}
                {verdictData.company}
              </h2>
              <p className="text-xs text-indigo-400 font-semibold tracking-wide">
                Stock symbol: {verdictData.symbol}
              </p>
            </div>
          </div>

          {/* Verdict Badge */}
          {isInvest ? (
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
              verdictData.confidence >= 75 ? "text-emerald-400" : verdictData.confidence >= 50 ? "text-amber-400" : "text-rose-400"
            }`}>
              {verdictData.confidence}%
            </span>
          </div>
          <div className="h-2.5 bg-slate-950 border border-slate-800/80 rounded-full overflow-hidden">
            <div
              style={{ width: `${confidenceWidthVal}%` }}
              className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${
                isInvest ? "from-indigo-500 to-emerald-500" : "from-indigo-500 to-rose-500"
              }`}
            />
          </div>
        </div>

        {/* Reasoning summary text */}
        <div className="bg-slate-950/50 border border-slate-900 rounded-xl p-4.5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Verdict Reasoning Summary
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed font-normal">
            {verdictData.reasoning}
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
              {verdictData.bullCase?.map((bull, i) => (
                <li key={i} className="flex gap-2 items-start leading-relaxed font-normal text-slate-300">
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
              {verdictData.bearCase?.map((bear, i) => (
                <li key={i} className="flex gap-2 items-start leading-relaxed font-normal text-slate-300">
                  <span className="text-rose-500/80 select-none mt-0.5">•</span>
                  {bear}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Risks details */}
        {verdictData.risks && verdictData.risks.length > 0 && (
          <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-indigo-400" />
              Identified Risk Analysis
            </h4>
            <ul className="text-xs text-slate-300 space-y-2">
              {verdictData.risks.map((risk, i) => (
                <li key={i} className="flex gap-2 items-start leading-relaxed font-normal text-slate-300">
                  <span className="text-indigo-500/80 select-none">•</span>
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sources list */}
        {verdictData.sources && verdictData.sources.length > 0 && (
          <div className="border-t border-slate-900 pt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
              Sources Cited:
            </span>
            {verdictData.sources.map((source, i) => {
              const isUrl = source.startsWith("http://") || source.startsWith("https://");
              if (isUrl) {
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
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[300px] right-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-900 pb-6 mb-6 gap-4">
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

        {/* Tab Toggle Navigation */}
        <div className="flex border-b border-slate-900 mb-8">
          <button
            onClick={() => {
              setMode("single");
              cleanupConnection("A");
              cleanupConnection("B");
            }}
            className={`py-3 px-6 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              mode === "single"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            Single Research
          </button>
          <button
            onClick={() => {
              setMode("compare");
              cleanupConnection("single");
            }}
            className={`py-3 px-6 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
              mode === "compare"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Compare Engine
          </button>
        </div>

        {/* Search & Suggestions Card */}
        <section className="mb-8 bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-md shadow-xl">
          {mode === "single" ? (
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
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); startComparison(queryA, queryB); }} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-3.5 text-pink-400 font-mono text-xs font-bold bg-pink-400/10 border border-pink-400/20 px-1.5 py-0.5 rounded">A</span>
                  <input
                    type="text"
                    value={queryA}
                    onChange={(e) => setQueryA(e.target.value)}
                    placeholder="Enter first company (e.g. Tesla)"
                    disabled={loadingA || loadingB}
                    className="w-full pl-14 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 transition-all disabled:opacity-50"
                  />
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-4 top-3.5 text-cyan-400 font-mono text-xs font-bold bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded">B</span>
                  <input
                    type="text"
                    value={queryB}
                    onChange={(e) => setQueryB(e.target.value)}
                    placeholder="Enter second company (e.g. Nvidia)"
                    disabled={loadingA || loadingB}
                    className="w-full pl-14 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 transition-all disabled:opacity-50"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={(loadingA || loadingB) || !queryA.trim() || !queryB.trim()}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {loadingA || loadingB ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Running Dual-Agent Stream...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-5 h-5" />
                    Compare Companies
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick-test templates */}
          <div className="flex flex-wrap items-center gap-2.5 mt-4 pt-4 border-t border-slate-900/60">
            <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase mr-1">
              Quick Test:
            </span>
            {mode === "single" ? (
              QUICK_COMPANIES.map((companyName) => (
                <button
                  key={companyName}
                  type="button"
                  onClick={() => handleCompanyClick(companyName)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-300 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {companyName}
                </button>
              ))
            ) : (
              COMPARE_PAIRS.map((pair) => (
                <button
                  key={pair.label}
                  type="button"
                  onClick={() => {
                    setQueryA(pair.a);
                    setQueryB(pair.b);
                    startComparison(pair.a, pair.b);
                  }}
                  disabled={loadingA || loadingB}
                  className="text-xs px-3 py-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-300 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pair.label}
                </button>
              ))
            )}
          </div>
        </section>

        {/* Dashboard Content Dynamic Layout */}
        {mode === "single" ? (
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
                  <div className="flex-1">
                    <h3 className="font-semibold text-rose-200">Analysis Error</h3>
                    <p className="text-sm text-rose-300/80 mt-1 leading-relaxed">{error}</p>
                    <button
                      type="button"
                      onClick={() => startAnalysis(query)}
                      className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-xs transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-rose-900/30"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retry Analysis
                    </button>
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
              {verdict && renderVerdictCard(verdict, confidenceWidth, "single")}

            </section>

          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Comparison Matrix at the top if verdicts exist */}
            {verdictA && verdictB && renderComparisonMatrix(verdictA, verdictB)}

            {/* Error Cards */}
            {errorA && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-6 rounded-2xl backdrop-blur-md shadow-xl flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-rose-200">Company A Analysis Error</h3>
                  <p className="text-sm text-rose-300/80 mt-1 leading-relaxed">{errorA}</p>
                  <button
                    type="button"
                    onClick={() => startStream(queryA, "A")}
                    className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-xs transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-rose-900/30"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retry Company A
                  </button>
                </div>
              </div>
            )}
            {errorB && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-6 rounded-2xl backdrop-blur-md shadow-xl flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-rose-200">Company B Analysis Error</h3>
                  <p className="text-sm text-rose-300/80 mt-1 leading-relaxed">{errorB}</p>
                  <button
                    type="button"
                    onClick={() => startStream(queryB, "B")}
                    className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-xs transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-rose-900/30"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retry Company B
                  </button>
                </div>
              </div>
            )}

            {/* Side-by-side Detailed Verdicts */}
            {(verdictA || verdictB || loadingA || loadingB) && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Column A */}
                {loadingA && !verdictA ? (
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
                ) : verdictA ? (
                  renderVerdictCard(verdictA, confidenceWidthA, "A")
                ) : null}

                {/* Column B */}
                {loadingB && !verdictB ? (
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
                ) : verdictB ? (
                  renderVerdictCard(verdictB, confidenceWidthB, "B")
                ) : null}
              </div>
            )}

            {/* Dynamic Welcome state for Compare mode */}
            {!loadingA && !loadingB && !verdictA && !verdictB && !errorA && !errorB && (
              <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-10 backdrop-blur-md shadow-xl text-center flex flex-col items-center justify-center min-h-[360px]">
                <div className="p-4 bg-indigo-500/10 rounded-full border border-indigo-500/20 mb-6 animate-pulse">
                  <Brain className="w-12 h-12 text-indigo-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-100">
                  Ready to Compare
                </h2>
                <p className="text-sm text-slate-400 max-w-md mt-2 leading-relaxed font-normal">
                  Enter two companies above or select a quick comparison template to start parallel analysis and see side-by-side investment verdicts.
                </p>
              </div>
            )}

            {/* Timelines and Console grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-6">
                <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 backdrop-blur-md shadow-xl">
                  <h3 className="text-md font-semibold text-slate-200 border-b border-slate-900 pb-4 mb-5 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    Agent Research Timelines
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Pipeline A */}
                    <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-pink-400" />
                        [A] {queryA || "Company A"}
                        {loadingA && (
                          <span className="text-[10px] text-slate-400 normal-case font-normal ml-auto flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin text-pink-400" />
                            {elapsedTimeA}s
                          </span>
                        )}
                      </h4>
                      <div className="relative border-l border-slate-800 ml-3 pl-5 space-y-4">
                        {stepsA.map((step) => {
                          const StepIcon = step.icon;
                          const isPending = step.status === "pending";
                          const isRunning = step.status === "running";
                          const isCompleted = step.status === "completed";
                          const isFailed = step.status === "failed";

                          return (
                            <div key={step.id} className="relative">
                              <span className="absolute -left-[29px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border transition-all">
                                {isCompleted && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 bg-slate-950 rounded-full" />
                                )}
                                {isRunning && (
                                  <Loader2 className="w-3 h-3 text-pink-400 animate-spin" />
                                )}
                                {isPending && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                )}
                                {isFailed && (
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                )}
                              </span>
                              <div>
                                <h3 className={`text-xs font-semibold flex items-center gap-1.5 ${
                                  isCompleted ? "text-slate-100" : isRunning ? "text-pink-400" : "text-slate-500"
                                }`}>
                                  <StepIcon className={`w-3.5 h-3.5 ${isRunning ? "animate-pulse" : ""}`} />
                                  {step.title}
                                </h3>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pipeline B */}
                    <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        [B] {queryB || "Company B"}
                        {loadingB && (
                          <span className="text-[10px] text-slate-400 normal-case font-normal ml-auto flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            {elapsedTimeB}s
                          </span>
                        )}
                      </h4>
                      <div className="relative border-l border-slate-800 ml-3 pl-5 space-y-4">
                        {stepsB.map((step) => {
                          const StepIcon = step.icon;
                          const isPending = step.status === "pending";
                          const isRunning = step.status === "running";
                          const isCompleted = step.status === "completed";
                          const isFailed = step.status === "failed";

                          return (
                            <div key={step.id} className="relative">
                              <span className="absolute -left-[29px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border transition-all">
                                {isCompleted && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 bg-slate-950 rounded-full" />
                                )}
                                {isRunning && (
                                  <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                                )}
                                {isPending && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                )}
                                {isFailed && (
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                )}
                              </span>
                              <div>
                                <h3 className={`text-xs font-semibold flex items-center gap-1.5 ${
                                  isCompleted ? "text-slate-100" : isRunning ? "text-cyan-400" : "text-slate-500"
                                }`}>
                                  <StepIcon className={`w-3.5 h-3.5 ${isRunning ? "animate-pulse" : ""}`} />
                                  {step.title}
                                </h3>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
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
                            {log.prefix && (
                              <span className={`font-bold ${log.prefix === "A" ? "text-pink-400" : "text-cyan-400"} mr-1.5`}>
                                [{log.prefix}]
                              </span>
                            )}
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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
