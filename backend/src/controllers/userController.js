import bcrypt from "bcrypt";
import User from "../models/User.js";
import LoanApplication from "../models/LoanApplication.js";

// ==================== GET PROFILE ====================
export const getProfile = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log(`Profile fetched for user: ${user.fullName}`);

    return res.status(200).json({
      user: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || "",
      },
    });
  } catch (error) {
    console.error("ERROR FETCHING PROFILE:", error.message);
    return res.status(500).json({
      message: "Error fetching profile",
      error: error.message,
    });
  }
};

// ==================== GET DASHBOARD ====================
export const getDashboard = async (req, res) => {
  try {
    const user = req.user;

    const latestLoan = await LoanApplication.findOne({ userId: user._id })
      .sort({ submittedAt: -1 })
      .select("aiAnalysis.creditScore submittedAt");
    const latestLoanScore =
      Number(latestLoan?.aiAnalysis?.creditScore || 0) || null;

    // Calculate account age in years
    const countAgeMs = Date.now() - new Date(user.createdAt).getTime();
    const accountAgeYears = Math.floor(
      countAgeMs / (1000 * 60 * 60 * 24 * 365)
    );

    // Count active loans
    const activeLoans = await LoanApplication.countDocuments({
      userId: user._id,
      status: { $in: ["approved", "disbursed", "accepted"] },
    });

    console.log(` Dashboard fetched for user: ${user.fullName}`);

    return res.status(200).json({
      fullName: user.fullName,
      accountNumber: user.accountNumber,
      borrowerType: user.borrowerType || "individual",
      creditStage: user.creditStage || "stage1",
      creditScore: latestLoanScore || user.creditScore || 600,
      scoreLastUpdated:
        latestLoan?.submittedAt || user.scoreLastUpdated || new Date(),
      accountAge: `${accountAgeYears} years`,
      isVerified: user.isVerified || false,
      isOnBoarded: user.isOnBoarded || false,
      activeLoansCount: activeLoans,
      memberSince: user.createdAt,
    });
  } catch (error) {
    console.error("ERROR FETCHING DASHBOARD:", error.message);
    return res.status(500).json({
      message: "Error fetching dashboard",
      error: error.message,
    });
  }
};

// ==================== GET ACTIVE LOANS ====================
export const getAcitveLoans = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const loans = await LoanApplication.find({
      userId,
      status: { $in: ["disbursed", "approved", "accepted"] },
    }).select("loanType requestedAmount status submittedAt");

    console.log(`Active loans fetched: ${loans.length}`);

    return res.status(200).json({ loans });
  } catch (error) {
    console.error("ERROR FETCHING ACTIVE LOANS:", error.message);
    return res.status(500).json({
      message: "Error fetching active loans",
      error: error.message,
    });
  }
};

// ==================== GET INSIGHTS ====================
export const getInsights = async (req, res) => {
  try {
    return res.status(200).json({
      insights: [
        "Your spending increased by 18% this month",
        "Maintaining balance can help build credit",
        "You are eligible for better interest rates",
      ],
      shapFactors: [
        { factor: "Utility bill consistency", impact: "+12" },
        { factor: "No transaction history", impact: "-8" },
      ],
    });
  } catch (error) {
    console.error("ERROR FETCHING INSIGHTS:", error.message);
    return res.status(500).json({
      message: "Error fetching insights",
      error: error.message,
    });
  }
};

// ==================== GET TRANSACTIONS ====================
export const getTransactions = async (req, res) => {
  try {
    return res.status(200).json({
      transactions: [
        { date: "12 Mar", name: "Amazon", type: "debit", amount: 1200 },
        { date: "10 Mar", name: "Salary", type: "credit", amount: 32000 },
        {
          date: "08 Mar",
          name: "Electricity Bill",
          type: "debit",
          amount: 800,
        },
      ],
    });
  } catch (error) {
    console.error("ERROR FETCHING TRANSACTIONS:", error.message);
    return res.status(500).json({
      message: "Error fetching transactions",
      error: error.message,
    });
  }
};

// ==================== GET ELIGIBILITY ====================
export const getEligibility = async (req, res) => {
  try {
    return res.status(200).json({
      eligibleAmount: 75000,
      eligibleLoanTypes: ["personal", "micro"],
      currentStage: req.user.creditStage || "stage1",
      nextStageRequirement: "Repay current loan on time for 3 months",
    });
  } catch (error) {
    console.error("ERROR FETCHING ELIGIBILITY:", error.message);
    return res.status(500).json({
      message: "Error fetching eligibility",
      error: error.message,
    });
  }
};

// ==================== CHANGE PASSWORD ====================
export const changePassword = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(userId);

    if (!user || !user.password) {
      return res.status(404).json({ message: "User not found" });
    }

    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isCurrentValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      return res
        .status(400)
        .json({ message: "New password must be different from the current password" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("ERROR CHANGING PASSWORD:", error.message);
    return res.status(500).json({
      message: "Error changing password",
      error: error.message,
    });
  }
};
