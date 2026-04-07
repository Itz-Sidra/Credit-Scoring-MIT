import { useState, useEffect } from "react";
import { User, Mail, Phone, KeyRound, Eye, EyeOff } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/apiClient";

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api';

export function ProfilePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Profile data
  const [profile, setProfile] = useState<{ fullName: string; email: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Change password state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`${API_BASE_URL}/user/profile`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    try {
      setChangingPassword(true);
      const response = await apiClient.put(`${API_BASE_URL}/user/change-password`, {
        currentPassword,
        newPassword,
      });

      if (response.ok) {
        setPasswordSuccess("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordSection(false);
        setTimeout(() => setPasswordSuccess(""), 3000);
      } else {
        const data = await response.json();
        setPasswordError(data.message || "Failed to change password");
      }
    } catch (error) {
      setPasswordError("An error occurred. Please try again.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col text-black font-sans selection:bg-blue-600 selection:text-white overflow-x-hidden">
      {/* Header — matches MyLoansPage exactly */}
      <header className="border-b-[1.5px] border-black bg-white flex-shrink-0 sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => navigate("/")}>
              <span className="text-xl md:text-2xl font-black tracking-tighter uppercase relative">
                CREDIT
                <span className="absolute -right-2.5 bottom-1.5 w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-600"></span>
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-10">
              <button onClick={() => navigate("/apply-loan")} className="text-black/60 hover:text-black transition-opacity text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">Apply For Loan</button>
              <button onClick={() => navigate("/my-loans")} className="text-black/60 hover:text-black transition-opacity text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">My Loans</button>
              <button className="text-blue-600 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] border-b-[2px] border-blue-600 pb-[2px]">Profile</button>
            </nav>
            <Button
              onClick={() => logout()}
              variant="outline"
              className="bg-black text-white hover:bg-black/80 rounded-none border-[1.5px] border-transparent font-black text-[10px] md:text-xs px-6 py-2 uppercase tracking-[0.2em] transition-all"
            >
              Sign Out &rarr;
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[85%] w-full mx-auto py-12">
        {/* Page Title */}
        <div className="mb-14">
          <h1 className="text-3xl md:text-5xl font-black text-black tracking-tighter uppercase leading-none">
            YOUR<br />
            <span className="text-blue-600">PROFILE.</span>
          </h1>
        </div>

        {loading ? (
          <div className="text-xs font-black uppercase tracking-widest text-black/50 animate-pulse py-20 text-center">Loading profile...</div>
        ) : profile ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT: User Details */}
            <div className="space-y-6">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-black/40 mb-2">Account Details</h2>

              {/* Full Name */}
              <div className="bg-white border border-slate-200 p-5 flex items-center gap-5 group hover:border-blue-600 transition-colors">
                <div className="w-10 h-10 bg-blue-600 flex items-center justify-center rounded-full flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-1">Full Name</p>
                  <p className="text-sm font-black text-black uppercase tracking-wider truncate">{profile.fullName}</p>
                </div>
              </div>

              {/* Email */}
              <div className="bg-white border border-slate-200 p-5 flex items-center gap-5 group hover:border-blue-600 transition-colors">
                <div className="w-10 h-10 bg-blue-600 flex items-center justify-center rounded-full flex-shrink-0">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-1">Email</p>
                  <p className="text-sm font-black text-black tracking-wider truncate">{profile.email}</p>
                </div>
              </div>

              {/* Phone */}
              <div className="bg-white border border-slate-200 p-5 flex items-center gap-5 group hover:border-blue-600 transition-colors">
                <div className="w-10 h-10 bg-blue-600 flex items-center justify-center rounded-full flex-shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-black/40 uppercase tracking-widest mb-1">Phone</p>
                  <p className="text-sm font-black text-black uppercase tracking-wider truncate">{profile.phone || "Not provided"}</p>
                </div>
              </div>

              {/* Success Toast */}
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-300 text-green-700 text-xs font-black uppercase tracking-widest p-4 text-center">
                  {passwordSuccess}
                </div>
              )}
            </div>

            {/* RIGHT: Actions */}
            <div className="space-y-6">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-black/40 mb-2">Account Actions</h2>

              {/* Change Password */}
              <div className="bg-white border border-slate-200 p-6">
                <button
                  onClick={() => { setShowPasswordSection(!showPasswordSection); setPasswordError(""); setPasswordSuccess(""); }}
                  className="flex items-center gap-4 w-full text-left group"
                >
                  <div className="w-10 h-10 bg-black flex items-center justify-center rounded-full flex-shrink-0 group-hover:bg-blue-600 transition-colors">
                    <KeyRound className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-black uppercase tracking-wider">Change Password</p>
                    <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mt-0.5">Update your account password</p>
                  </div>
                </button>

                {showPasswordSection && (
                  <div className="mt-6 space-y-4 pt-4 border-t border-slate-200">
                    {/* Current Password */}
                    <div>
                      <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block mb-2">Current Password</label>
                      <div className="relative">
                        <input
                          type={showCurrentPw ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full border border-slate-200 bg-white px-4 py-3 text-xs font-black text-black uppercase tracking-wider focus:border-blue-600 focus:outline-none transition-colors rounded-none"
                          placeholder="ENTER CURRENT PASSWORD"
                        />
                        <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black">
                          {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block mb-2">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full border border-slate-200 bg-white px-4 py-3 text-xs font-black text-black uppercase tracking-wider focus:border-blue-600 focus:outline-none transition-colors rounded-none"
                          placeholder="ENTER NEW PASSWORD"
                        />
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black">
                          {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="text-[10px] font-black text-black/40 uppercase tracking-widest block mb-2">Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full border border-slate-200 bg-white px-4 py-3 text-xs font-black text-black uppercase tracking-wider focus:border-blue-600 focus:outline-none transition-colors rounded-none"
                        placeholder="RE-ENTER NEW PASSWORD"
                      />
                    </div>

                    {passwordError && (
                      <p className="text-xs font-black text-red-500 uppercase tracking-widest">{passwordError}</p>
                    )}

                    <Button
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                      className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-none border-none font-black text-xs uppercase tracking-[0.15em] h-12 transition-all disabled:opacity-50"
                    >
                      {changingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs font-black uppercase tracking-widest text-red-500 py-20 text-center">Failed to load profile</div>
        )}
      </main>
    </div>
  );
}
