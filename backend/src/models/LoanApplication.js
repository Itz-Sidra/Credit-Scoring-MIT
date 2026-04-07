import mongoose from "mongoose";

const loanApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Human-readable loan code (e.g., P1, H3)
  loanCode: { type: String, index: true, unique: true, sparse: true },

  // Loan details
  loanType: {
    type: String,
    enum: ["personal", "home", "auto", "education", "business", "credit_card"],
    required: true,
  },
  requestedAmount: { type: Number, required: true },
  requestedTenure: { type: Number }, // in months
  purpose: { type: String },

  // Collateral
  collateral: {
    type: {
      type: String,
      enum: ["land", "property", "vehicle", "gold", "none"],
      default: "none",
    },
    estimatedValue: { type: Number },
    pincode: { type: String },
    marketRatePerSqFt: { type: Number },
    verifiedValue: { type: Number },
  },

  // Loan-specific details
  homeDetails: {
    area: { type: Number }, // in sq ft
    bhk: { type: String },
    location: { type: String },
    propertyType: { type: String }, // ready built, under construction, etc.
  },

  autoDetails: {
    vehicleType: { type: String }, // car, bike, truck, etc.
    model: { type: String },
    registrationNumber: { type: String },
    estimatedValue: { type: Number },
  },

  businessDetails: {
    businessType: { type: String }, // msme, large
    businessName: { type: String },
    yearsInOperation: { type: Number },
    annualTurnover: { type: Number },
  },

  // AI scoring output
  aiAnalysis: {
    creditScore: { type: Number, default: 600 },
    eligibleAmount: { type: Number },
    suggestedInterestRate: { type: Number, default: 12.5 },
    suggestedTenure: { type: Number },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    shapFactors: { type: Object, default: {} },
    amlFlags: { type: [String], default: [] },
    modelVersion: { type: String },
  },

  features: {
    type: Object,
    default: {},
  },

  // Application status
  status: {
    type: String,
    enum: [
      "pending", // just submitted
      "auto_approved", // low risk, auto approved
      "under_review", // medium risk, sent to admin
      "auto_rejected", // high risk, auto rejected
      "approved", // admin approved
      "rejected", // admin rejected
      "accepted", // user accepted the offer
      "declined", // user declined the offer
      "disbursed", // money sent
      "closed", // fully repaid
    ],
    default: "pending",
  },

  // Admin assignment
  assignedAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  assignedAt: { type: Date },

  // Admin decision
  adminDecision: {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAmount: { type: Number },
    interestRate: { type: Number },
    tenure: { type: Number },
    rejectionReason: { type: String },
    decidedAt: { type: Date },
    notes: { type: String },
  },

  // Disbursement
  disbursement: {
    method: {
      type: String,
      enum: ["bank_transfer", "wallet", "aeps", "pmjdy"],
    },
    accountDetails: { type: String },
    disbursedAt: { type: Date },
    disbursedAmount: { type: Number },
    transactionId: { type: String },
  },

  // Second loan check
  existingLoanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LoanApplication",
  },
  existingRepaymentPercentage: { type: Number },

  submittedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const LoanApplication = mongoose.model(
  "LoanApplication",
  loanApplicationSchema
);
export default LoanApplication;
