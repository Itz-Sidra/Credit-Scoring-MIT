import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Users, AlertTriangle, Search } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/apiClient";

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8000/api";

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  riskLevel: string;
  riskScore: number;
  totalLoans: number;
  activeLoans: number;
  rejectedLoans: number;
  approvedLoans: number;
  totalRequestedAmount: number;
  avgRequestedAmount: number;
  lastLoanAt: string | null;
}

function normalizeRiskLabel(riskLevel: string) {
  const value = String(riskLevel || "unknown").toLowerCase();
  if (value === "low") return "Low";
  if (value === "medium") return "Medium";
  if (value === "high") return "High";
  return "Unknown";
}

function statusIsActive(status: string) {
  return ["approved", "accepted", "disbursed", "auto_approved"].includes(String(status || ""));
}

export function AdminUserDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    void fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`${API_BASE_URL}/admin/my-loans`);
      if (!response.ok) {
        setRows([]);
        return;
      }

      const body = await response.json();
      const loans = body.loans || [];
      const grouped = new Map<string, AdminUserRow>();

      loans.forEach((loan: any) => {
        const user = loan.userId || {};
        const userId = String(user._id || "");
        if (!userId) return;

        const existing = grouped.get(userId) || {
          id: userId,
          name: user.fullName || "Unknown",
          email: user.email || "N/A",
          phone: user.phone || "N/A",
          riskLevel: normalizeRiskLabel(loan.aiAnalysis?.riskLevel),
          riskScore: Number(loan.aiAnalysis?.creditScore || 0),
          totalLoans: 0,
          activeLoans: 0,
          rejectedLoans: 0,
          approvedLoans: 0,
          totalRequestedAmount: 0,
          avgRequestedAmount: 0,
          lastLoanAt: null,
        };

        existing.totalLoans += 1;
        existing.totalRequestedAmount += Number(loan.requestedAmount || 0);

        if (statusIsActive(loan.status)) {
          existing.activeLoans += 1;
        }
        if (["rejected", "auto_rejected"].includes(String(loan.status || ""))) {
          existing.rejectedLoans += 1;
        }
        if (["approved", "accepted", "disbursed", "auto_approved"].includes(String(loan.status || ""))) {
          existing.approvedLoans += 1;
        }

        const submittedAt = loan.submittedAt ? new Date(loan.submittedAt).toISOString() : null;
        if (!existing.lastLoanAt || (submittedAt && submittedAt > existing.lastLoanAt)) {
          existing.lastLoanAt = submittedAt;
          existing.riskLevel = normalizeRiskLabel(loan.aiAnalysis?.riskLevel);
          existing.riskScore = Number(loan.aiAnalysis?.creditScore || existing.riskScore || 0);
        }

        grouped.set(userId, existing);
      });

      const data = Array.from(grouped.values())
        .map((item) => ({
          ...item,
          avgRequestedAmount: item.totalLoans > 0 ? Math.round(item.totalRequestedAmount / item.totalLoans) : 0,
        }))
        .sort((a, b) => b.totalLoans - a.totalLoans);

      setRows(data);
      if (!selectedUserId && data.length > 0) {
        setSelectedUserId(data[0].id);
      }
    } catch (error) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.email, r.phone].some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, searchTerm]);

  const selectedUser = filteredRows.find((r) => r.id === selectedUserId) || filteredRows[0] || null;

  const summary = useMemo(() => {
    const totalUsers = rows.length;
    const highRiskUsers = rows.filter((r) => r.riskLevel === "High").length;
    const repeatBorrowers = rows.filter((r) => r.totalLoans > 1).length;
    const repeatPct = totalUsers > 0 ? Math.round((repeatBorrowers / totalUsers) * 100) : 0;
    return { totalUsers, highRiskUsers, repeatPct };
  }, [rows]);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="w-full px-6 sm:px-8 md:px-10 lg:px-12">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <img src="/images/download.png" alt="Logo" className="w-8 h-8 object-contain" />
              <span className="font-bold text-lg sm:text-xl text-slate-900">CREDIT - Admin</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <button onClick={() => navigate("/admin")} className="text-slate-600 hover:text-slate-900 transition-colors">Dashboard</button>
              <button onClick={() => navigate("/admin/users")} className="text-slate-900 font-medium hover:text-blue-600 transition-colors">Users</button>
              <button onClick={() => navigate("/admin/loans")} className="text-slate-600 hover:text-slate-900 transition-colors">Loans</button>
              <button onClick={() => navigate("/admin/reports")} className="text-slate-600 hover:text-slate-900 transition-colors">Audit Log</button>
              <button onClick={() => navigate("/admin/models")} className="text-slate-600 hover:text-slate-900 transition-colors">Models</button>
            </nav>
            <Button
              onClick={() => logout()}
              variant="outline"
              className="border-blue-600 text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 font-semibold"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full px-10 sm:px-12 md:px-16 lg:px-20 xl:px-24 py-8 flex-1 overflow-y-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Users Overview</h1>
            <p className="text-slate-600 text-sm mt-1">Live analytics derived from applications in your admin scope.</p>
          </div>
          <Button onClick={() => void fetchUsers()} variant="outline" className="border-slate-300 text-slate-700">
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-600 uppercase font-semibold">Total Users</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{summary.totalUsers}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-600 uppercase font-semibold">High Risk Users</p>
            <p className="text-3xl font-bold text-red-500 mt-2">{summary.highRiskUsers}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-600 uppercase font-semibold">Repeat Borrowers</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{summary.repeatPct}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search user by name, email or phone"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900"
                />
              </div>
              {loading && <span className="text-sm text-slate-500">Loading...</span>}
            </div>

            <div className="overflow-auto max-h-[520px]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Risk</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Loans</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Active</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Avg Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedUserId(row.id)}
                      className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${selectedUser?.id === row.id ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold ${row.riskLevel === "High" ? "text-red-500" : row.riskLevel === "Medium" ? "text-amber-500" : "text-green-600"}`}>
                          {row.riskLevel} ({row.riskScore || "N/A"})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-800">{row.totalLoans}</td>
                      <td className="px-4 py-3 text-slate-800">{row.activeLoans}</td>
                      <td className="px-4 py-3 text-slate-800">₹{row.avgRequestedAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {!loading && filteredRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No users found in this admin scope.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 uppercase mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Selected User
            </h3>

            {selectedUser ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-500">Name</p>
                  <p className="text-slate-900 font-semibold">{selectedUser.name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="text-slate-900 font-semibold">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="text-slate-900 font-semibold">{selectedUser.phone}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-50 rounded-md p-3">
                    <p className="text-xs text-slate-500">Total Loans</p>
                    <p className="text-lg font-bold text-slate-900">{selectedUser.totalLoans}</p>
                  </div>
                  <div className="bg-slate-50 rounded-md p-3">
                    <p className="text-xs text-slate-500">Active Loans</p>
                    <p className="text-lg font-bold text-slate-900">{selectedUser.activeLoans}</p>
                  </div>
                  <div className="bg-slate-50 rounded-md p-3">
                    <p className="text-xs text-slate-500">Approved</p>
                    <p className="text-lg font-bold text-green-600">{selectedUser.approvedLoans}</p>
                  </div>
                  <div className="bg-slate-50 rounded-md p-3">
                    <p className="text-xs text-slate-500">Rejected</p>
                    <p className="text-lg font-bold text-red-500">{selectedUser.rejectedLoans}</p>
                  </div>
                </div>
                <div className="pt-2">
                  <p className="text-slate-500">Average Requested Amount</p>
                  <p className="text-slate-900 font-semibold">₹{selectedUser.avgRequestedAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-500">Last Loan Date</p>
                  <p className="text-slate-900 font-semibold">{selectedUser.lastLoanAt ? new Date(selectedUser.lastLoanAt).toLocaleString("en-IN") : "N/A"}</p>
                </div>
                {selectedUser.riskLevel === "High" && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-semibold">Watchlist Candidate (high risk)</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No user selected.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
