import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { MyLoansPage } from "./MyLoansPage";
import { AdminDashboard } from "./AdminDashboard";

export function Dashboard() {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<"user" | "admin" | null>(null);

  useEffect(() => {
    const storedUserType = localStorage.getItem("userType") as "user" | "admin" | null;
    
    if (!storedUserType) {
      navigate("/login");
      return;
    }
    
    setUserType(storedUserType);
  }, [navigate]);

  if (!userType) {
    return null;
  }

  return userType === "user" ? <MyLoansPage /> : <AdminDashboard />;
}
