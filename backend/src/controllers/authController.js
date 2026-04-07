import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generateTokens } from "../utils/generateTokens.js";
import { sendEmailOTP, verifyEmailOTP } from "../services/emailService.js";
import { inMemoryUsers } from "../services/dbFallback.js";
import redisClient from "../config/redis.js";

// In-memory temp signup data for development
const inMemoryTempSignups = new Map();

const shouldExposeDebugEmailOtp = () =>
  process.env.NODE_ENV === "development" ||
  process.env.ALLOW_EMAIL_OTP_FALLBACK === "true";

async function getTempSignupData({ phone, email }) {
  if (phone && email) {
    try {
      const data = await redisClient.get(`tempsignup:${phone}:${email}`);
      if (data) {
        return { key: `tempsignup:${phone}:${email}`, data: JSON.parse(data) };
      }
    } catch (error) {
      const inMemory = inMemoryTempSignups.get(`${phone}:${email}`);
      if (inMemory) {
        return { key: `${phone}:${email}`, data: inMemory };
      }
    }
  }

  if (!email) {
    return null;
  }

  try {
    const keys = await redisClient.keys(`tempsignup:*:${email}`);
    if (keys.length > 0) {
      const matchedKey = keys[0];
      const raw = await redisClient.get(matchedKey);
      if (raw) {
        return { key: matchedKey, data: JSON.parse(raw) };
      }
    }
  } catch (error) {
    // Ignore and fall back to in-memory.
  }

  for (const [key, value] of inMemoryTempSignups.entries()) {
    if (String(key).endsWith(`:${email}`)) {
      return { key, data: value };
    }
  }

  return null;
}

async function persistTempSignupData(storageKey, tempSignupData) {
  if (storageKey && storageKey.startsWith("tempsignup:")) {
    await redisClient.setex(storageKey, 900, JSON.stringify(tempSignupData));
    return;
  }

  const fallbackKey = `${tempSignupData.phone}:${tempSignupData.email}`;
  inMemoryTempSignups.set(fallbackKey, tempSignupData);
}

async function deleteTempSignupData(storageKey, phone, email) {
  try {
    if (storageKey && storageKey.startsWith("tempsignup:")) {
      await redisClient.del(storageKey);
      return;
    }
  } catch (error) {
    // Ignore and clear in-memory fallback.
  }

  inMemoryTempSignups.delete(`${phone}:${email}`);
}

export const signup = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    console.log(`Signup request: phone=${phone}, email=${email}`);

    if (!fullName || !email || !phone || !password) {
      console.log(`Missing fields`);
      return res
        .status(400)
        .json({ message: "fullName, email, phone and password are required" });
    }

    // Check if user already exists
    let existingUser = null;
    try {
      existingUser = await User.findOne({
        $or: [{ phone }, { email }],
      });
    } catch (dbError) {
      if (process.env.NODE_ENV === "development") {
        existingUser = Array.from(inMemoryUsers.values()).find(
          (u) => u.phone === phone || u.email === email
        );
      } else {
        throw dbError;
      }
    }

    if (existingUser) {
      console.log(`User already exists: ${phone}`);
      return res.status(400).json({ message: "Phone or email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store temporary signup data (NOT creating user yet)
    const tempSignupData = {
      fullName,
      email,
      phone,
      password: hashedPassword,
      phoneVerified: false,
      emailVerified: false,
      createdAt: new Date(),
    };

    try {
      // Try to store in Redis
      await redisClient.setex(
        `tempsignup:${phone}:${email}`,
        900, // 15 minutes expiry
        JSON.stringify(tempSignupData)
      );
      console.log(`Temp signup data stored in Redis for: ${phone}`);
    } catch (error) {
      // Fallback to in-memory storage so signup can continue even if Redis is down.
      console.warn("Redis error, using in-memory temp signup storage");
      inMemoryTempSignups.set(`${phone}:${email}`, tempSignupData);
      setTimeout(() => {
        inMemoryTempSignups.delete(`${phone}:${email}`);
      }, 900000);
    }

    // Email-only OTP signup flow
    console.log(`📧 Sending signup OTP to email: ${email}`);
    const emailOtpResult = await sendEmailOTP(email);
    console.log(`Signup email OTP sent successfully to: ${email}`);

    return res.status(200).json({
      message: "OTP sent to email",
      step: "verify_email_otp",
      email: email.split("@")[0] + "@***.*",
      ...(emailOtpResult?.otpPreviewUrl
        ? { otpPreviewUrl: emailOtpResult.otpPreviewUrl }
        : {}),
      ...(shouldExposeDebugEmailOtp() && emailOtpResult?.otp
        ? { debugEmailOtp: emailOtpResult.otp }
        : {}),
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res
      .status(500)
      .json({ message: "Error during signup", error: error.message });
  }
};

export const verifyOtp = async (req, res) => {
  return res.status(410).json({
    message:
      "This phone-OTP endpoint is deprecated. Use /auth/verify-email-otp for signup and /auth/verify-login-otp for login.",
  });
};

// ==================== NEW SIGNUP FLOW WITH EMAIL VERIFICATION ====================

export const verifyPhoneOtp = async (req, res) => {
  return res.status(410).json({
    message:
      "Phone OTP is no longer used. Signup is email-OTP only. Use /auth/verify-email-otp.",
  });
};

export const verifyEmailOtp = async (req, res) => {
  try {
    const { phone, email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "email and otp are required" });
    }

    console.log(`Verifying email OTP for: ${email}`);

    const tempRecord = await getTempSignupData({ phone, email });
    const tempSignupData = tempRecord?.data;

    if (!tempSignupData) {
      console.error(`No signup data found for: ${email}`);
      return res
        .status(404)
        .json({ message: "Signup session not found. Please signup again." });
    }

    // Verify email OTP
    try {
      await verifyEmailOTP(email, otp);
      console.log(`Email OTP verified for: ${email}`);
    } catch (otpError) {
      console.error(`Email OTP verification failed: ${otpError.message}`);
      return res
        .status(400)
        .json({ message: otpError.message || "Invalid email OTP" });
    }

    tempSignupData.emailVerified = true;
    tempSignupData.phoneVerified = true;

    // NOW CREATE THE USER
    console.log(`👤 Creating user with verified phone and email: ${phone}`);

    const userToSave = new User({
      fullName: tempSignupData.fullName,
      email: tempSignupData.email,
      phone: tempSignupData.phone,
      password: tempSignupData.password,
      isOnBoarded: true,
      phoneVerified: true,
      emailVerified: true,
      loginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
    });

    try {
      // Try to save to database
      const savedUser = await userToSave.save();
      console.log(`User created successfully in database: ${phone}`);

      // Delete temp signup data
      await deleteTempSignupData(
        tempRecord?.key,
        tempSignupData.phone,
        tempSignupData.email
      );

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(
        savedUser._id,
        savedUser.role || "user"
      );

      return res.status(201).json({
        message: "User registered successfully!",
        accessToken,
        refreshToken,
        user: {
          fullName: savedUser.fullName,
          email: savedUser.email,
          phone: savedUser.phone,
          phoneVerified: savedUser.phoneVerified,
          emailVerified: savedUser.emailVerified,
        },
      });
    } catch (dbError) {
      if (process.env.NODE_ENV === "development") {
        // Fallback to in-memory
        inMemoryUsers.set(phone, userToSave.toObject());
        console.warn("Using in-memory storage for user:", phone);

        // Delete temp signup data
        await deleteTempSignupData(
          tempRecord?.key,
          tempSignupData.phone,
          tempSignupData.email
        );

        const { accessToken, refreshToken } = generateTokens(phone, "user");

        return res.status(201).json({
          message: "User registered successfully! (offline mode)",
          accessToken,
          refreshToken,
          user: {
            fullName: tempSignupData.fullName,
            email: tempSignupData.email,
            phone: tempSignupData.phone,
            phoneVerified: true,
            emailVerified: true,
          },
        });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error("Email OTP verification error:", error);
    return res
      .status(500)
      .json({ message: "Error verifying email OTP", error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { phone, email, password } = req.body;

    console.log(
      `Login attempt: phone=${phone || "N/A"}, email=${email || "N/A"}`
    );

    if ((!phone && !email) || !password) {
      console.log(`Missing identifier or password`);
      return res
        .status(400)
        .json({ message: "phone or email and password are required" });
    }

    let user = null;
    try {
      // Try to query database
      if (email) {
        user = await User.findOne({ email });
        if (user) console.log(`User found in database by email: ${email}`);
      } else {
        user = await User.findOne({ phone });
        if (user) console.log(`User found in database by phone: ${phone}`);
      }
    } catch (dbError) {
      // If database is unavailable, check in-memory storage
      console.log(`Database error, checking in-memory: ${dbError.message}`);
      if (process.env.NODE_ENV === "development") {
        user = email
          ? Array.from(inMemoryUsers.values()).find((u) => u.email === email)
          : inMemoryUsers.get(phone);
        if (user) console.log(`User found in-memory: ${email || phone}`);
      } else {
        throw dbError;
      }
    }

    if (!user && process.env.NODE_ENV === "development") {
      user = email
        ? Array.from(inMemoryUsers.values()).find((u) => u.email === email)
        : inMemoryUsers.get(phone);
      if (user)
        console.log(`User found in-memory (fallback): ${email || phone}`);
    }

    if (!user) {
      console.log(`User not found: ${email || phone}`);
      return res.status(404).json({ message: "User not found" });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (60 * 1000)
      );
      console.log(`Account locked: ${phone}`);
      return res
        .status(423)
        .json({ message: `Account locked, try after ${minutesLeft} minutes` });
    }

    const isMatch = await bcrypt.compare(password, user.password || "");

    if (!isMatch) {
      console.log(`Invalid password for: ${phone}`);
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      if (user.loginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.loginAttempts = 0;
        console.log(`Account locked after 5 failed attempts: ${phone}`);
      }

      try {
        if (user.save) {
          await user.save();
        } else {
          inMemoryUsers.set(phone, user);
        }
      } catch (dbError) {
        if (process.env.NODE_ENV !== "development") {
          throw dbError;
        }
      }

      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log(`Password matched for: ${email || phone}`);
    user.loginAttempts = 0;
    user.lockedUntil = null;

    try {
      if (user.save) {
        await user.save();
      } else {
        const key = user.phone || phone;
        if (key) {
          inMemoryUsers.set(key, user);
        }
      }
    } catch (dbError) {
      if (process.env.NODE_ENV !== "development") {
        throw dbError;
      }
    }

    // If admin, return tokens directly (bypassing OTP)
    if (user.role === "admin") {
      console.log(`Admin ${user.email} logged in directly`);
      const { accessToken, refreshToken } = generateTokens(user._id, user.role);
      return res.status(200).json({
        accessToken,
        refreshToken,
        user: {
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
    }

    console.log(`Sending login OTP to email: ${user.email}`);
    const emailOtpResult = await sendEmailOTP(user.email);
    console.log(`Login OTP sent successfully to email: ${user.email}`);

    return res.status(200).json({
      message: "OTP sent to email, please verify",
      ...(emailOtpResult?.otpPreviewUrl
        ? { otpPreviewUrl: emailOtpResult.otpPreviewUrl }
        : {}),
      ...(shouldExposeDebugEmailOtp() && emailOtpResult?.otp
        ? { debugEmailOtp: emailOtpResult.otp }
        : {}),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ message: "Error logging in", error: error.message });
  }
};

export const verifyLoginOTP = async (req, res) => {
  try {
    const { phone, email, otp } = req.body;

    if ((!phone && !email) || !otp) {
      return res
        .status(400)
        .json({ message: "phone or email and otp are required" });
    }

    let user = null;
    try {
      // Try to query database
      user = email
        ? await User.findOne({ email })
        : await User.findOne({ phone });
    } catch (dbError) {
      // If database is unavailable, check in-memory storage
      if (process.env.NODE_ENV === "development") {
        user = email
          ? Array.from(inMemoryUsers.values()).find((u) => u.email === email)
          : inMemoryUsers.get(phone);
      } else {
        throw dbError;
      }
    }

    if (!user && process.env.NODE_ENV === "development") {
      user = email
        ? Array.from(inMemoryUsers.values()).find((u) => u.email === email)
        : inMemoryUsers.get(phone);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify email OTP for login
    try {
      await verifyEmailOTP(user.email, otp);
      console.log(`Login email OTP verified for: ${user.email}`);
    } catch (otpError) {
      if (otpError.message.includes("expired") || otpError.message.includes("not found")) {
        return res.status(400).json({ message: "OTP expired or not found" });
      }

      if (otpError.message.toLowerCase().includes("invalid")) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      throw otpError;
    }

    const { accessToken, refreshToken } = generateTokens(
      user._id,
      user.role || "user"
    );

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Login OTP verification error:", error);
    return res
      .status(500)
      .json({ message: "Error verifying login OTP", error: error.message });
  }
};

// ==================== REFRESH TOKEN ====================
export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      console.log("Refresh token verified, userId:", decoded.userId);

      let user = await User.findById(decoded.userId).select("-password");

      if (!user && process.env.NODE_ENV === "development") {
        user = inMemoryUsers.get(decoded.userId);
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { accessToken: newAccessToken } = generateTokens(
        user._id,
        user.role || "user"
      );

      return res.status(200).json({
        accessToken: newAccessToken,
        user: {
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
        },
      });
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ message: "Refresh token expired. Please login again." });
      }
      return res.status(401).json({ message: "Invalid refresh token" });
    }
  } catch (error) {
    console.error("Error refreshing token:", error);
    return res
      .status(500)
      .json({ message: "Error refreshing token", error: error.message });
  }
};

// ==================== RESEND EMAIL OTP (Gmail Verification Only) ====================
export const resendEmailOtp = async (req, res) => {
  try {
    const { phone, email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    console.log(`Resending email OTP for: ${email}`);

    const tempRecord = await getTempSignupData({ phone, email });
    const tempSignupData = tempRecord?.data;

    if (!tempSignupData) {
      console.error(`No signup data found for: ${email}`);
      return res
        .status(404)
        .json({ message: "Signup session not found. Please signup again." });
    }

    // Only resend email OTP - NO phone verification required again
    console.log(`Sending email OTP to: ${email}`);
    const emailOtpResult = await sendEmailOTP(email);
    console.log(`Email OTP resent to: ${email}`);

    return res.status(200).json({
      message: "Email OTP resent successfully",
      step: "verify_email_otp",
      email: tempSignupData.email.split("@")[0] + "@***.*",
      ...(emailOtpResult?.otpPreviewUrl
        ? { otpPreviewUrl: emailOtpResult.otpPreviewUrl }
        : {}),
      ...(shouldExposeDebugEmailOtp() && emailOtpResult?.otp
        ? { debugEmailOtp: emailOtpResult.otp }
        : {}),
    });
  } catch (error) {
    console.error("Resend email OTP error:", error);
    return res
      .status(500)
      .json({ message: "Error resending email OTP", error: error.message });
  }
};