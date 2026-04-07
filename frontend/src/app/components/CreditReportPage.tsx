import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { RefreshCcw, TrendingUp, AlertTriangle, CheckCircle2, Wallet } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/apiClient";

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8000/api";

export function CreditReportPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [allLoans, setAllLoans] = useState<any[]>([]);

  useEffect(() => {
    void loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const [dRes, eRes, iRes, tRes, aRes, loansRes] = await Promise.all([
        apiClient.get(`${API_BASE_URL}/user/dashboard`),
        apiClient.get(`${API_BASE_URL}/user/eligibility`),
        apiClient.get(`${API_BASE_URL}/user/insights`),
        apiClient.get(`${API_BASE_URL}/user/transactions`),
        apiClient.get(`${API_BASE_URL}/user/loans/active`),
        apiClient.get(`${API_BASE_URL}/loan/my-loans`),
      ]);

      setDashboard(dRes.ok ? await dRes.json() : null);
      setEligibility(eRes.ok ? await eRes.json() : null);
      setInsights(iRes.ok ? (await iRes.json())?.insights || [] : []);
      setTransactions(tRes.ok ? (await tRes.json())?.transactions || [] : []);
      setActiveLoans(aRes.ok ? (await aRes.json())?.loans || [] : []);
      setAllLoans(loansRes.ok ? (await loansRes.json())?.loans || [] : []);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const creditScore = Number(dashboard?.creditScore || 0);
    const scoreBand = creditScore >= 740 ? "Excellent" : creditScore >= 670 ? "Good" : creditScore >= 580 ? "Fair" : "Needs Improvement";

    const totalRequested = allLoans.reduce((sum, loan) => sum + Number(loan.requestedAmount || 0), 0);
    const avgRequested = allLoans.length > 0 ? Math.round(totalRequested / allLoans.length) : 0;

    const latestLoan = allLoans
      .slice()
      .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())[0];

    return {
      creditScore,
      scoreBand,
      totalLoans: allLoans.length,
      avgRequested,
      latestRisk: latestLoan?.aiAnalysis?.riskLevel || "N/A",
      latestModelVersion: latestLoan?.aiAnalysis?.modelVersion || "N/A",
      latestPD: latestLoan?.features?.probabilityOfDefault,
    };
  }, [dashboard, allLoans]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white shadow-sm flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
              <img src="/images/download.png" alt="Logo" className="w-6 h-6 object-contain" />
              <span className="font-serif font-bold text-xl text-slate-900 tracking-wide uppercase">CREDIT</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <button onClick={() => navigate("/dashboard")} className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium">Dashboard</button>
              <button className="text-blue-600 font-semibold border-b-2 border-blue-600 pb-[2px] text-sm">Credit Report</button>
              <button onClick={() => navigate("/apply-loan")} className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium">Apply For Loan</button>
              <button onClick={() => navigate("/my-loans")} className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium">My Loans</button>
            </nav>
            <div className="flex items-center gap-2">
              <Button onClick={() => void loadReport()} variant="outline" className="border-slate-300 text-slate-700 h-8 px-3">
                <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Refresh
              </Button>
              <Button onClick={() => logout()} variant="outline" className="border-blue-600 text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 text-xs h-8 px-4">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Credit Report</h1>
          <p className="text-slate-600 mt-1 text-sm">Live user analytics powered by backend profile and loan decision APIs.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs uppercase font-semibold text-slate-500">Credit Score</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{summary.creditScore || "N/A"}</p>
            <p className="text-sm text-blue-600 font-semibold mt-1">{summary.scoreBand}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs uppercase font-semibold text-slate-500">Active Loans</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{activeLoans.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs uppercase font-semibold text-slate-500">Eligible Amount</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">₹{Number(eligibility?.eligibleAmount || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs uppercase font-semibold text-slate-500">Avg Loan Ask</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">₹{summary.avgRequested.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 uppercase mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Personalized Insights
            </h3>
            {loading ? (
              <p className="text-sm text-slate-500">Loading insights...</p>
            ) : insights.length === 0 ? (
              <p className="text-sm text-slate-500">No insights available.</p>
            ) : (
              <div className="space-y-2">
                {insights.map((insight, idx) => (
                  <div key={idx} className="text-sm text-slate-700 bg-blue-50 border border-blue-100 rounded-md p-3">
                    {insight}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 uppercase mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Transaction Snapshot
            </h3>
            {loading ? (
              <p className="text-sm text-slate-500">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-slate-500">No transactions available.</p>
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 6).map((txn, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                    <div>
                      <p className="font-medium text-slate-900">{txn.name}</p>
                      <p className="text-xs text-slate-500">{txn.date}</p>
                    </div>
                    <span className={`font-semibold ${txn.type === "credit" ? "text-green-600" : "text-red-500"}`}>
                      {txn.type === "credit" ? "+" : "-"}₹{Number(txn.amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 uppercase mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Eligibility Detail
            </h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-500">Current Stage:</span> <span className="font-semibold text-slate-900">{eligibility?.currentStage || "N/A"}</span></p>
              <p><span className="text-slate-500">Eligible Loan Types:</span> <span className="font-semibold text-slate-900">{(eligibility?.eligibleLoanTypes || []).join(", ") || "N/A"}</span></p>
              <p><span className="text-slate-500">Next Stage Requirement:</span> <span className="font-semibold text-slate-900">{eligibility?.nextStageRequirement || "N/A"}</span></p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 uppercase mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Latest Loan Model Signals
            </h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-500">Latest Risk:</span> <span className="font-semibold text-slate-900">{summary.latestRisk}</span></p>
              <p><span className="text-slate-500">Model Version:</span> <span className="font-semibold text-slate-900">{summary.latestModelVersion}</span></p>
              <p><span className="text-slate-500">Probability of Default:</span> <span className="font-semibold text-slate-900">{summary.latestPD != null ? `${(Number(summary.latestPD) * 100).toFixed(1)}%` : "N/A"}</span></p>
              <p><span className="text-slate-500">Total Loans on Record:</span> <span className="font-semibold text-slate-900">{summary.totalLoans}</span></p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
