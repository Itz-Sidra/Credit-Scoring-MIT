import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./ui/input-otp";
import { authService } from "../services/authService";


export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [userType, setUserType] = useState<"user" | "admin">("user");
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [otpFor, setOtpFor] = useState<"login" | "signup-email">("login");
  const [signupStep, setSignupStep] = useState<"form" | "email-otp">("form");
  const [canResendOtp, setCanResendOtp] = useState(true);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  /** Hackathon / dev: Ethereal “demo inbox” URL to open the OTP in browser (free, no API keys). */
  const [otpPreviewUrl, setOtpPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (userType === "admin") {
      setIsSignUp(false);
    }
  }, [userType]);

  useEffect(() => {
    if (!showOtp) {
      setOtpPreviewUrl(null);
    }
  }, [showOtp]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (resendCountdown === 0 && !canResendOtp) {
      setCanResendOtp(true);
    }
  }, [resendCountdown, canResendOtp]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (userType === "admin") {
        if (!email || !password) {
          setError("Email ID and password are required");
          setLoading(false);
          return;
        }

        const response = await authService.login({
          email,
          password,
        });

        if (response.accessToken && response.refreshToken && response.user) {
          authService.setTokens(response.accessToken, response.refreshToken);
          localStorage.setItem("userType", "admin");
          localStorage.setItem("userData", JSON.stringify(response.user));
          login(response.user, "admin");
          navigate("/admin");
        } else {
          setError("Invalid admin credentials");
        }
      } else {
        if (!mobile || !password) {
          setError("Phone number and password are required");
          setLoading(false);
          return;
        }

        const loginRes = await authService.login({
          phone: mobile,
          password,
        });

        if (loginRes.otpPreviewUrl) {
          setOtpPreviewUrl(loginRes.otpPreviewUrl);
        }
        setShowOtp(true);
        setOtpFor("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!fullName || !mobile || !email || !password) {
        setError("All fields are required");
        setLoading(false);
        return;
      }

      const signupRes = await authService.signup({
        fullName,
        email,
        phone: mobile,
        password,
      });

      if (signupRes.otpPreviewUrl) {
        setOtpPreviewUrl(signupRes.otpPreviewUrl);
      }
      // Email-only signup OTP flow
      setShowOtp(true);
      setOtpFor("signup-email");
      setSignupStep("email-otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!otp) {
        setError("OTP is required");
        setLoading(false);
        return;
      }

      let response;

      if (signupStep === "email-otp") {
        // Verify email OTP → creates user
        console.log('Verifying email OTP and creating user...');
        response = await authService.verifyEmailOtp({
          phone: mobile,
          email: email,
          otp,
        });
      } else {
        // Login OTP verification
        response = await authService.verifyLoginOtp({
          phone: mobile,
          otp,
        });
      }

      authService.setTokens(response.accessToken, response.refreshToken);
      localStorage.setItem("userType", "user");
      localStorage.setItem("userData", JSON.stringify(response.user));
      login(response.user, "user");

      navigate("/apply-loan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (canResendOtp) {
      setError("");
      setLoading(true);

      try {
        if (signupStep === "email-otp") {
          const r = await authService.resendEmailOtp({
            phone: mobile,
            email,
          });
          if (r.otpPreviewUrl) {
            setOtpPreviewUrl(r.otpPreviewUrl);
          }
        } else {
          const r = await authService.login({
            phone: mobile,
            password,
          });
          if (r.otpPreviewUrl) {
            setOtpPreviewUrl(r.otpPreviewUrl);
          }
        }

        setOtp("");
        setCanResendOtp(false);
        setResendCountdown(30);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to resend OTP");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col items-center justify-center p-4 md:p-8 font-sans selection:bg-blue-600 selection:text-white overflow-hidden">

      {/* Main Branding Section */}
      <div className="w-full max-w-sm mb-8 flex flex-col items-center text-center">
        <h1 className="text-[10vw] md:text-[4rem] leading-none font-black tracking-tighter uppercase mb-1">
            CREDIT
        </h1>
        <div className="w-10 h-1 bg-blue-600 mb-3" />
        <p className="font-black text-base md:text-lg uppercase italic tracking-tighter">
            No history? <span className="text-blue-600">No worries.</span>
        </p>
      </div>

      {/* Login / Signup Form Container */}
      <div className="w-full max-w-sm">
        
        {/* USER | ADMIN Toggle */}
        {!showOtp && (
          <div className="flex items-center justify-center gap-8 mb-6 font-black text-xs tracking-[0.3em] uppercase">
            <button 
              type="button"
              onClick={() => setUserType("user")}
              className={`pb-1 border-b-2 transition-all ${userType === "user" ? "border-blue-600 text-black" : "border-transparent text-gray-300"}`}
            >
              USER
            </button>
            <span className="text-gray-200">|</span>
            <button 
              type="button"
              onClick={() => setUserType("admin")}
              className={`pb-1 border-b-2 transition-all ${userType === "admin" ? "border-blue-600 text-black" : "border-transparent text-gray-300"}`}
            >
              ADMIN
            </button>
          </div>
        )}

        <h3 className="text-2xl font-black text-black mb-4 uppercase tracking-tighter">
          {isSignUp ? "SIGN UP" : "LOGIN"}
        </h3>

        {error && (
          <div className="mb-4 p-3 border-[1.5px] border-red-500 bg-red-50 text-red-600 text-[10px] md:text-xs font-black uppercase tracking-wider">
            ERROR: {error}
          </div>
        )}

        {!showOtp && (
          <form className="space-y-4 mb-4">
            {isSignUp && (
              <div className="group">
                <Label htmlFor="fullName" className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-focus-within:text-black transition-colors mb-2 block">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 bg-transparent border-[1px] border-black rounded-none shadow-none focus-visible:ring-0 focus-visible:border-[2.5px] transition-all font-bold"
                />
              </div>
            )}

            {userType === "user" ? (
              <div className="group">
                <Label htmlFor="mobile" className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-focus-within:text-black transition-colors mb-2 block">
                  {isSignUp ? "Mobile Number" : "Phone Number"}
                </Label>
                <Input
                  id="mobile"
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder={isSignUp ? "+91..." : "e.g. 9870000001"}
                  className="h-12 bg-transparent border-[1px] border-black rounded-none shadow-none focus-visible:ring-0 focus-visible:border-[2.5px] transition-all font-bold placeholder:opacity-20"
                />
              </div>
            ) : (
              <div className="group">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-focus-within:text-black transition-colors mb-2 block">
                  Email ID
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@credit.com"
                  className="h-12 bg-transparent border-[1px] border-black rounded-none shadow-none focus-visible:ring-0 focus-visible:border-[2.5px] transition-all font-bold placeholder:opacity-20"
                />
              </div>
            )}

            {isSignUp && (
              <div className="group">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-focus-within:text-black transition-colors mb-2 block">
                  Email ID
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="h-12 bg-transparent border-[1px] border-black rounded-none shadow-none focus-visible:ring-0 focus-visible:border-[2.5px] transition-all font-bold placeholder:opacity-20"
                />
              </div>
            )}

            <div className="group">
              <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-gray-400 group-focus-within:text-black transition-colors mb-2 block">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-transparent border-[1px] border-black rounded-none shadow-none focus-visible:ring-0 focus-visible:border-[2.5px] transition-all font-bold pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={isSignUp ? handleSignUp : handleLogin}
                disabled={loading}
                className="w-full h-12 bg-black hover:bg-black/90 text-white font-black text-sm md:text-base rounded-none shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest transition-all"
              >
                {loading ? "PROCESSING..." : isSignUp ? "CREATE" : "SIGN IN"}
              </Button>
            </div>

            {userType === "user" && (
              <p className="text-black text-[10px] font-black tracking-widest uppercase text-center mt-3">
                {isSignUp ? "Already a member? " : "New here? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setOtp("");
                    setShowOtp(false);
                    setError("");
                    setSignupStep("form");
                  }}
                  className="text-blue-600 underline underline-offset-4 hover:opacity-70 transition-opacity"
                >
                  {isSignUp ? "SIGN IN" : "CREATE"}
                </button>
              </p>
            )}
          </form>
        )}

        {/* OTP Screen Redesign */}
        {showOtp && (
          <form onSubmit={handleOtpSubmit} className="space-y-8 mt-6 pt-10 border-t-[1.5px] border-black/10 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6 block">
                {signupStep === "email-otp" ? "ENTER EMAIL OTP" : "ENTER VERIFICATION CODE"}
              </Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={(value) => setOtp(value)}>
                  <InputOTPGroup className="gap-2 md:gap-3">
                    <InputOTPSlot index={0} className="w-12 h-14 md:w-14 md:h-16 bg-white border-[1.5px] border-black text-black text-2xl font-black rounded-none focus:ring-0 focus:border-[3px]" />
                    <InputOTPSlot index={1} className="w-12 h-14 md:w-14 md:h-16 bg-white border-[1.5px] border-black text-black text-2xl font-black rounded-none" />
                    <InputOTPSlot index={2} className="w-12 h-14 md:w-14 md:h-16 bg-white border-[1.5px] border-black text-black text-2xl font-black rounded-none" />
                    <InputOTPSlot index={3} className="w-12 h-14 md:w-14 md:h-16 bg-white border-[1.5px] border-black text-black text-2xl font-black rounded-none" />
                    <InputOTPSlot index={4} className="w-12 h-14 md:w-14 md:h-16 bg-white border-[1.5px] border-black text-black text-2xl font-black rounded-none" />
                    <InputOTPSlot index={5} className="w-12 h-14 md:w-14 md:h-16 bg-white border-[1.5px] border-black text-black text-2xl font-black rounded-none" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-[9px] md:text-[10px] text-gray-400 mt-6 font-black uppercase tracking-widest text-center">
                {signupStep === "email-otp" ? "OTP sent to your email address." : "An OTP has been dispatched to your identity."}
              </p>
              {otpPreviewUrl && (
                <div className="mt-4 p-3 border-[1.5px] border-blue-600/40 bg-blue-50/80 text-center space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-900">
                    Demo mode — open test inbox to read your code (free, no mailbox setup)
                  </p>
                  <a
                    href={otpPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-[10px] font-black uppercase tracking-wider text-blue-600 underline underline-offset-4 hover:opacity-80"
                  >
                    Open demo inbox →
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-4">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-black hover:bg-black/90 text-white font-black text-lg rounded-none shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em]"
              >
                {loading ? "VERIFYING..." : "SUBMIT OTP →"}
              </Button>
              
              <div className="flex flex-col items-center md:flex-row md:gap-8 gap-4 mt-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={!canResendOtp || loading}
                  className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${canResendOtp && !loading
                      ? "text-black border-black hover:opacity-60"
                      : "text-gray-300 border-transparent cursor-not-allowed"
                    }`}
                >
                  {canResendOtp ? "RESEND CODE" : `RESEND IN ${resendCountdown}S`}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setShowOtp(false);
                    setOtp("");
                    setError("");
                  }}
                  disabled={loading}
                  className="text-gray-300 border-b-2 border-transparent hover:text-black hover:border-black transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  GO BACK
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}