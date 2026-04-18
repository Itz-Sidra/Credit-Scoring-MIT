import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, AlertCircle, Database, BrainCircuit } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/apiClient";

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8000/api";

interface ModelReadyPayload {
  ready: boolean;
  database?: { ready: boolean; state: number };
  model?: {
    ready: boolean;
    artifactPath?: string;
    runnerPath?: string;
    pythonBinary?: string;
    reason?: string;
  };
}

export function ModelStatus() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState<ModelReadyPayload | null>(null);
  const [loanRows, setLoanRows] = useState<any[]>([]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => {
      void loadData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [readyRes, loansRes] = await Promise.all([
        fetch(`${API_BASE_URL}/health/ready`),
        apiClient.get(`${API_BASE_URL}/admin/my-loans`),
      ]);

      if (readyRes.ok) {
        const readyBody = await readyRes.json();
        setReady(readyBody);
      } else {
        setReady(null);
      }

      if (loansRes.ok) {
        const loansBody = await loansRes.json();
        setLoanRows(loansBody.loans || []);
      } else {
        setLoanRows([]);
      }
    } catch (error) {
      setReady(null);
      setLoanRows([]);
    } finally {
      setLoading(false);
    }
  };

  const telemetry = useMemo(() => {
    const scoring = { ml_model: 0, legacy_fallback: 0, unknown: 0 };
    const risk = { low: 0, medium: 0, high: 0, unknown: 0 };
    const modelVersionCount = new Map<string, number>();

    loanRows.forEach((loan) => {
      const source = String(loan?.features?.scoringSource || "unknown");
      if (source === "ml_model") scoring.ml_model += 1;
      else if (source === "legacy_fallback") scoring.legacy_fallback += 1;
      else scoring.unknown += 1;

      const riskLevel = String(loan?.aiAnalysis?.riskLevel || "unknown");
      if (riskLevel === "low") risk.low += 1;
      else if (riskLevel === "medium") risk.medium += 1;
      else if (riskLevel === "high") risk.high += 1;
      else risk.unknown += 1;

      const version = String(loan?.aiAnalysis?.modelVersion || "unknown");
      modelVersionCount.set(version, (modelVersionCount.get(version) || 0) + 1);
    });

    const modelVersions = Array.from(modelVersionCount.entries())
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalLoans: loanRows.length,
      scoring,
      risk,
      modelVersions,
      mlCoveragePct: loanRows.length > 0 ? Math.round((scoring.ml_model / loanRows.length) * 100) : 0,
    };
  }, [loanRows]);

  const modelHealthy = Boolean(ready?.model?.ready);
  const dbHealthy = Boolean(ready?.database?.ready);

  return (
    <div className="h-screen flex flex-col bg-[#f5f7fb]">
      <header className="bg-white border-b-[1.5px] border-black flex-shrink-0 z-10 relative">
        <div className="w-full px-6 sm:px-8 md:px-10 lg:px-12">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <span className="font-black text-xl sm:text-2xl text-black uppercase tracking-tight">CREDIT</span>
            </div>
            <nav className="hidden md:flex items-center gap-8 mt-1">
              <button onClick={() => navigate("/admin")} className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600">Dashboard</button>
              <button onClick={() => navigate("/admin/loans")} className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600">Loans</button>
              <button onClick={() => navigate("/admin/reports")} className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600">Audit Log</button>
              <button onClick={() => navigate("/admin/models")} className="text-blue-600 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-700 transition-all pb-1.5 border-b-[3px] border-blue-600">Models</button>
              <button onClick={() => navigate("/admin/copilot")} className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600">Chat</button>
            </nav>
            <Button
              onClick={() => logout()}
              variant="outline"
              className="border-[1.5px] border-black text-black bg-white hover:bg-black hover:text-white rounded-none font-black text-xs uppercase tracking-[0.15em] transition-all hover:scale-[1.03]"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full px-6 sm:px-8 md:px-12 lg:px-16 py-12 flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-14 flex items-start justify-between">
            <div>
              <h1 className="text-5xl md:text-6xl font-black text-black tracking-tighter uppercase">MODEL STATUS</h1>
              <p className="text-black/60 font-bold uppercase tracking-widest text-xs mt-3">Live model/runtime telemetry from backend readiness and scored loans.</p>
            </div>
            <Button onClick={() => void loadData()} variant="outline" className="border-[1.5px] border-black text-black rounded-none font-black text-xs uppercase tracking-[0.15em] hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-colors px-6 py-3">
              REFRESH
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white border-[1.5px] border-black p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
              <p className="text-[10px] uppercase text-black/50 font-black tracking-[0.2em] mb-3">Model Runtime</p>
              <p className={`text-4xl font-black tracking-tighter uppercase ${modelHealthy ? "text-blue-600" : "text-slate-400"}`}>
                {modelHealthy ? "UP" : "DOWN"}
              </p>
            </div>
            <div className="bg-white border-[1.5px] border-black p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
              <p className="text-[10px] uppercase text-black/50 font-black tracking-[0.2em] mb-3">Database</p>
              <p className={`text-4xl font-black tracking-tighter uppercase ${dbHealthy ? "text-blue-600" : "text-slate-400"}`}>
                {dbHealthy ? "UP" : "DOWN"}
              </p>
            </div>
            <div className="bg-white border-[1.5px] border-black p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform">
              <p className="text-[10px] uppercase text-black/50 font-black tracking-[0.2em] mb-3">Loans Observed</p>
              <p className="text-4xl font-black text-black tracking-tighter uppercase">{telemetry.totalLoans}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 mb-8">
            <div className="bg-white border-[1.5px] border-black p-8 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
              <h3 className="text-sm font-black text-black uppercase tracking-[0.15em] mb-6 flex items-center gap-3 border-b-[1.5px] border-black/10 pb-4">
                <Activity className="w-5 h-5 text-blue-600" />
                Risk Distribution
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-bold uppercase tracking-widest text-black/70">
                <div className="flex flex-col gap-1 bg-white border-[1.5px] border-black/10 p-6 items-center justify-center text-center"><span>LOW</span><span className="font-black text-blue-400 text-4xl tracking-tighter">{telemetry.risk.low}</span></div>
                <div className="flex flex-col gap-1 bg-white border-[1.5px] border-black/10 p-6 items-center justify-center text-center"><span>MEDIUM</span><span className="font-black text-blue-500 text-4xl tracking-tighter">{telemetry.risk.medium}</span></div>
                <div className="flex flex-col gap-1 bg-white border-[1.5px] border-black/10 p-6 items-center justify-center text-center"><span>HIGH</span><span className="font-black text-blue-700 text-4xl tracking-tighter">{telemetry.risk.high}</span></div>
                <div className="flex flex-col gap-1 bg-white border-[1.5px] border-black/10 p-6 items-center justify-center text-center"><span>UNKNOWN</span><span className="font-black text-slate-500 text-4xl tracking-tighter">{telemetry.risk.unknown}</span></div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-white border-[1.5px] border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] p-8">
            <h3 className="text-sm font-black text-black uppercase tracking-[0.15em] mb-6 flex items-center gap-3 border-b-[1.5px] border-black/10 pb-4">
              <Database className="w-5 h-5 text-blue-600" />
              Runtime Artifacts
            </h3>
            {loading ? (
              <p className="text-black/50 text-xs font-bold uppercase tracking-widest animate-pulse">LOADING LOGS...</p>
            ) : ready ? (
              <div className="space-y-4 text-xs font-bold uppercase tracking-widest">
                <div className="flex items-center gap-4 border-b-[1.5px] border-black/5 pb-3"><span className="text-black/50 w-32 shrink-0">MODEL READY:</span> <span className={`font-black tracking-wider ${modelHealthy ? "text-blue-600 bg-blue-50/70 px-2 py-1 border-[1.5px] border-blue-200" : "text-slate-600 bg-slate-50 px-2 py-1 border-[1.5px] border-slate-300"}`}>{String(modelHealthy)}</span></div>
                <div className="flex items-center gap-4 border-b-[1.5px] border-black/5 pb-3"><span className="text-black/50 w-32 shrink-0">PYTHON BINARY:</span> <span className="font-black text-blue-600 break-all">{ready.model?.pythonBinary || "N/A"}</span></div>
                <div className="flex items-center gap-4 border-b-[1.5px] border-black/5 pb-3"><span className="text-black/50 w-32 shrink-0">ARTIFACT PATH:</span> <span className="font-black text-black break-all">{ready.model?.artifactPath || "N/A"}</span></div>
                <div className="flex items-center gap-4 border-b-[1.5px] border-black/5 pb-3"><span className="text-black/50 w-32 shrink-0">RUNNER PATH:</span> <span className="font-black text-black break-all">{ready.model?.runnerPath || "N/A"}</span></div>
                {!modelHealthy && ready.model?.reason && (
                  <div className="flex items-center gap-4 border-b-[1.5px] border-black/5 pb-3"><span className="text-black/50 w-32 shrink-0">CRASH REASON:</span> <span className="font-black text-red-500 break-all">{ready.model.reason}</span></div>
                )}

                <div className="pt-6">
                  <p className="text-black/50 font-black tracking-[0.2em] mb-4">MODEL VERSION DISTRIBUTION</p>
                  <div className="space-y-3">
                    {telemetry.modelVersions.length === 0 && <p className="text-xs text-black/30 italic">NO SCORED LOANS DETECTED</p>}
                    {telemetry.modelVersions.map((entry) => (
                      <div key={entry.version} className="flex justify-between items-center text-xs border-[1.5px] border-black/10 px-5 py-4 bg-slate-50 hover:border-blue-600 transition-colors">
                        <span className="text-blue-600 font-black">{entry.version}</span>
                        <span className="text-black font-black text-lg tracking-tighter">{entry.count} LOANS</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-red-500 font-black text-sm uppercase tracking-widest bg-red-50 px-4 py-3 border-[1.5px] border-red-500/30">
                <AlertCircle className="w-5 h-5" />
                Could not load model readiness payload.
              </div>
            )}

            {modelHealthy && dbHealthy && (
              <div className="mt-8 flex items-center gap-3 text-blue-600 font-black text-xs uppercase tracking-widest bg-blue-50 px-4 py-3 border-[1.5px] border-blue-500/30">
                <CheckCircle2 className="w-5 h-5" />
                BACKEND & ML RUNTIME SYSTEMS ARE HEALTHY
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
