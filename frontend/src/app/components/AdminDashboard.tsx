import { CreditCard, DollarSign, Activity, CheckCircle, XCircle, Clock, X, FileText } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/apiClient";

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [adminLoanType, setAdminLoanType] = useState<string>("");
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loanTypeLabels: {[key: string]: string} = {
    'personal': 'Personal Loan',
    'home': 'Home Loan',
    'education': 'Education Loan',
    'auto': 'Automobile Loan',
    'business': 'Business Loan',
    'credit_card': 'Credit Card'
  };

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 5000); // Refresh every 5 seconds
    
    // Listen for loan status changes
    const handleLoanStatusChange = () => {
      console.log('🔄 Loan status changed, refreshing dashboard...');
      fetchDashboardData();
    };
    
    window.addEventListener('loanStatusChanged', handleLoanStatusChange);
    
    fetchDashboardData(); // Fetch on mount
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('loanStatusChanged', handleLoanStatusChange);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await apiClient.get(`${API_BASE_URL}/admin/dashboard`);
      
      if (response.ok) {
        const data = await response.json();
        setAdminLoanType(data.adminLoanType);
        setDashboardData(data.metrics);
        console.log('Dashboard data loaded:', data);
      } else {
        console.error('Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const keyMetrics = dashboardData ? [
    { title: "Total Applications", value: dashboardData.totalApplications?.toString() || "0", icon: CreditCard, color: "from-blue-500 to-blue-600", bgColor: "bg-blue-500/10", iconColor: "text-blue-400" },
    { title: "Approved", value: dashboardData.approvedLoans?.toString() || "0", icon: CheckCircle, color: "from-green-500 to-green-600", bgColor: "bg-green-500/10", iconColor: "text-green-400" },
    { title: "Rejected", value: dashboardData.rejectedLoans?.toString() || "0", icon: XCircle, color: "from-red-500 to-red-600", bgColor: "bg-red-500/10", iconColor: "text-red-400" },
    { title: "Auto Rejected", value: dashboardData.autoRejectedLoans?.toString() || "0", icon: XCircle, color: "from-rose-500 to-rose-600", bgColor: "bg-rose-500/10", iconColor: "text-rose-400" },
    { title: "Pending", value: dashboardData.pendingLoans?.toString() || "0", icon: Clock, color: "from-yellow-500 to-yellow-600", bgColor: "bg-yellow-500/10", iconColor: "text-yellow-400" },
  ] : [];

  const financialMetrics = dashboardData ? [
    { 
      title: "Total Disbursed", 
      value: `₹ ${dashboardData.totalDisbursed ? (dashboardData.totalDisbursed / 100000).toFixed(1) : "0"}L`, 
      icon: DollarSign, 
      color: "from-indigo-500 to-indigo-600", 
      bgColor: "bg-indigo-500/10", 
      iconColor: "text-indigo-400"
    },
    { 
      title: "Active Loans", 
      value: dashboardData.activeLoans?.toString() || "0", 
      icon: Activity, 
      color: "from-purple-500 to-purple-600", 
      bgColor: "bg-purple-500/10", 
      iconColor: "text-purple-400"
    },
  ] : [];

  return (
    <div className="h-screen flex flex-col bg-white">
      <style>{`
        html {
          scrollbar-gutter: stable;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .modal-backdrop {
          animation: fadeIn 0.3s ease-out;
        }
        .modal-content {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>
      {/* Header */}
      <header className="bg-white border-b-[1.5px] border-black flex-shrink-0 z-10 relative">
        <div className="w-full px-6 sm:px-8 md:px-10 lg:px-12">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <img src="/images/download.png" alt="Barclays Logo" className="w-8 h-8 object-contain" />
              <span className="font-black text-xl sm:text-2xl text-black uppercase tracking-tight">CREDIT <span className="text-black/30"></span></span>
            </div>
            <nav className="hidden md:flex items-center gap-8 mt-1">
              <button onClick={() => navigate("/admin")} className="text-blue-600 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-700 transition-all pb-1.5 border-b-[3px] border-blue-600">Dashboard</button>
              {/* <button onClick={() => navigate("/admin/users")} className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600">Users</button> */}
              <button onClick={() => navigate("/admin/loans")} className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600">Loans</button>
              <button onClick={() => navigate("/admin/reports")} className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600">Audit Log</button>
              <button onClick={() => navigate("/admin/models")} className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600">Models</button>
              <button onClick={() => navigate("/admin/copilot")} className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600">Chat</button>
            </nav>
            <Button
              onClick={() => {
                logout();
              }}
              variant="outline"
              className="border-[1.5px] border-black text-black bg-white hover:bg-black hover:text-white rounded-none font-black text-xs uppercase tracking-[0.15em] transition-all hover:scale-[1.03]"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-6 sm:px-8 md:px-12 lg:px-16 py-12 flex-1 overflow-y-auto bg-[#fafafa]">
        <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-14">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-4">
              <div>
                <h1 className="text-5xl md:text-6xl font-black text-black tracking-tighter uppercase">DASHBOARD</h1>
                {adminLoanType && (
                  <div className="mt-4 inline-flex items-center gap-2 border-[1.5px] border-blue-600 bg-blue-50/50 px-4 py-1.5">
                    <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Managing:</span>
                    <span className="text-sm font-black text-black uppercase tracking-wider">{loanTypeLabels[adminLoanType] || adminLoanType}</span>
                  </div>
                )}
              </div>
              {loading && <p className="text-black font-bold text-xs uppercase tracking-widest animate-pulse border-[1.5px] border-black px-3 py-1 bg-white">Updating...</p>}
            </div>
          </div>

          {/* Key Metrics Section */}
          <div className="mb-16">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-base md:text-lg font-black text-black uppercase tracking-[0.2em]">Application Status</h2>
              <div className="h-[1.5px] flex-1 bg-black/10"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {keyMetrics.map((stat, index) => (
                <div
                  key={index}
                  className="group relative bg-white border border-slate-200 p-6 transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.03] hover:border-blue-600 hover:shadow-[0_12px_24px_-8px_rgba(37,99,235,0.25)] cursor-pointer overflow-hidden"
                >
                  {/* Subtle structural accent */}
                  <div className="absolute top-0 right-0 w-8 h-8 border-l border-b border-slate-100 transition-colors group-hover:border-blue-600/30"></div>
                  
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex-1">
                      <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-[0.15em] mb-3">{stat.title}</p>
                      <p className="text-4xl md:text-5xl font-black text-black tracking-tighter group-hover:text-blue-600 transition-colors duration-300">{stat.value}</p>
                    </div>
                    <div className="mt-1 flex-shrink-0">
                      {/* <stat.icon className="w-6 h-6 text-black/40 group-hover:text-blue-600 transition-colors duration-300" strokeWidth={2.5} /> */}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Metrics Section */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-base md:text-lg font-black text-black uppercase tracking-[0.2em]">Financial Overview</h2>
              <div className="h-[1.5px] flex-1 bg-black/10"></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {financialMetrics.map((stat, index) => (
                <div
                  key={index}
                  className="group relative bg-white border border-slate-200 p-8 sm:p-10 transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.03] hover:border-blue-600 hover:shadow-[0_12px_30px_-5px_rgba(37,99,235,0.25)] cursor-pointer overflow-hidden"
                >
                  {/* Subtle brutalist grid background pattern */}
                  <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(0,0,0,1)_1.5px,transparent_1.5px),linear-gradient(90deg,rgba(0,0,0,1)_1.5px,transparent_1.5px)] bg-[size:24px_24px] pointer-events-none group-hover:opacity-[0.08] transition-opacity duration-500"></div>
                  
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex-1">
                      <p className="text-xs md:text-sm text-slate-500 font-bold uppercase tracking-[0.2em] mb-4">{stat.title}</p>
                      <p className="text-5xl md:text-7xl font-black text-black tracking-tighter group-hover:text-blue-600 transition-colors duration-300">{stat.value}</p>
                    </div>
                    {/* <div className="mt-2 flex-shrink-0 bg-blue-50 p-4 rounded-sm border border-blue-200 group-hover:border-blue-600 group-hover:bg-blue-100 transition-all duration-300">
                      <stat.icon className="w-8 h-8 md:w-10 md:h-10 text-black group-hover:text-blue-600 transition-colors duration-300" strokeWidth={2.5} />
                    </div> */}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Application Details Modal */}

    </div>
  );
}
