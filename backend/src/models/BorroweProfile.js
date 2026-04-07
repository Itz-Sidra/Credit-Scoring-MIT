import mongoose from "mongoose";

const borrowerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  borrowerType: { type: String, required: true },

  // Salaried specific
  salaried: {
    employerName: String,
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "contract"],
    },
    monthlySalary: Number,
    payslipPath: String,
    employerAddress: String,
    yearsEmployed: Number,
  },

  // Farmer specific
  farmer: {
    landArea: Number, // in acres
    landPincode: String,
    cropTypes: [String],
    kisanCardNumber: String,
    annualIncome: Number,
    landOwnership: { type: String, enum: ["owned", "leased"] },
  },

  // Small business / MSME specific
  smallBusiness: {
    businessName: String,
    businessType: String,
    gstNumber: String,
    annualRevenue: Number,
    yearsInOperation: Number,
    upiId: String,
    monthlyTransactionVolume: Number,
  },

  // Student specific
  student: {
    collegeName: String,
    course: String,
    yearOfStudy: Number,
    monthlyAllowance: Number,
    coApplicantName: String, // parent
    coApplicantPhone: String,
    coApplicantIncome: Number,
  },

  // No income specific
  noIncome: {
    dependentOn: String,
    savingsAmount: Number,
    monthlyExpenses: Number,
  },

  // Common financial data
  existingEMIs: [
    {
      lender: String,
      monthlyAmount: Number,
      remainingMonths: Number,
      loanType: String,
    },
  ],
  totalExistingEMIBurden: Number,

  // Alternative data
  alternativeData: {
    upiTransactionCount: Number, // last 6 months
    upiTransactionVolume: Number,
    utilityBillConsistency: Number, // 0 to 1 score
    transactionHistoryPath: String, // uploaded CSV path
    ecommerceSalesVolume: Number,
  },

  updatedAt: { type: Date, default: Date.now },
});

const BorrowerProfile = mongoose.model(
  "BorrowerProfile",
  borrowerProfileSchema
);
export default BorrowerProfile;
