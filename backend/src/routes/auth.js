import express from "express";
import {
  signup,
  verifyOtp,
  verifyEmailOtp,
  login,
  verifyLoginOTP,
  refreshAccessToken,
  resendEmailOtp,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/verify-otp", verifyOtp); // Legacy endpoint (for existing login flow)
router.post("/verify-email-otp", verifyEmailOtp); // New: Verify email OTP and create user
router.post("/resend-email-otp", resendEmailOtp); // New: Resend email OTP (Gmail verification only - no phone verification required)
router.post("/login", login);
router.post("/verify-login-otp", verifyLoginOTP);
router.post("/refresh-token", refreshAccessToken);

export default router;
