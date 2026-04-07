import { createBrowserRouter } from "react-router";
import { HomePage } from "./components/HomePage";
import { LoginPage } from "./components/LoginPage";
import { Dashboard } from "./components/Dashboard";
import { CreditReportPage } from "./components/CreditReportPage";
import { AdminDashboard } from "./components/AdminDashboard";
import { AdminLoanApplications } from "./components/AdminLoanApplications";
import { AdminUserDashboard } from "./components/AdminUserDashboard";
import { AuditLog } from "./components/AuditLog";
import { ModelStatus } from "./components/ModelStatus";
import { AdminCopilot } from "./components/AdminCopilot";
import { ApplyLoanPage } from "./components/ApplyLoanPage";
import { MyLoansPage } from "./components/MyLoansPage";
import { ProfilePage } from "./components/ProfilePage";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: HomePage,
    errorElement: (
      <div className="min-h-screen bg-[#050B14] flex flex-col items-center justify-center text-white p-4">
        <h1 className="text-6xl font-black text-red-500 mb-4">404</h1>
        <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
        <p className="text-gray-400 mb-8 text-center max-w-md">The page you are looking for doesn't exist or has been moved.</p>
        <a href="/" className="bg-[#00AEEF] hover:bg-[#009bcf] text-white font-bold py-3 px-6 rounded-full transition-colors">
          Return Home
        </a>
      </div>
    ),
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/dashboard",
    element: <ProtectedRoute><Dashboard /></ProtectedRoute>,
  },
  {
    path: "/credit-report",
    element: <ProtectedRoute requiredRole="user"><CreditReportPage /></ProtectedRoute>,
  },
  {
    path: "/apply-loan",
    element: <ProtectedRoute requiredRole="user"><ApplyLoanPage /></ProtectedRoute>,
  },
  {
    path: "/my-loans",
    element: <ProtectedRoute requiredRole="user"><MyLoansPage /></ProtectedRoute>,
  },
  {
    path: "/profile",
    element: <ProtectedRoute requiredRole="user"><ProfilePage /></ProtectedRoute>,
  },
  {
    path: "/admin",
    element: <ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>,
  },
  {
    path: "/admin/loans",
    element: <ProtectedRoute requiredRole="admin"><AdminLoanApplications /></ProtectedRoute>,
  },
  {
    path: "/admin/users",
    element: <ProtectedRoute requiredRole="admin"><AdminUserDashboard /></ProtectedRoute>,
  },
  {
    path: "/admin/reports",
    element: <ProtectedRoute requiredRole="admin"><AuditLog /></ProtectedRoute>,
  },
  {
    path: "/admin/models",
    element: <ProtectedRoute requiredRole="admin"><ModelStatus /></ProtectedRoute>,
  },
  {
    path: "/admin/copilot",
    element: <ProtectedRoute requiredRole="admin"><AdminCopilot /></ProtectedRoute>,
  },
]);