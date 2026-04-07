import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, default: null },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    adminLoanType: {
      type: String,
      enum: [
        "personal",
        "home",
        "education",
        "auto",
        "business",
        "credit_card",
      ],
      default: null,
    }, // For admin: which loan type they manage
    isOnBoarded: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },

    //credit related fields
    gender: { type: String, enum: ["M", "F"] },
    flagOwnCar: { type: Boolean, default: false },
    flagOwnRealty: { type: Boolean, default: false },
    cntChildren: { type: Number, default: 0 },
    incomTotal: { type: Number },
    amtCredit: { type: Number },
    goodsPrice: { type: Number },
    nameIncomeType: {
      type: String,
      enum: [
        "Working",
        "Commercial associate",
        "Pensioner",
        "State servant",
        "Student",
      ],
    },
    nameEducationType: {
      type: String,
      enum: [
        "Secondary / secondary special",
        "Higher education",
        "Incomplete higher",
        "Lower secondary",
        "Academic degree",
      ],
    },
    nameContractType: { type: String, enum: ["Cash loans", "Revolving loans"] },
    daysEmployed: { type: Number },
    ownCarAge: { type: Number },
    flagMobile: { type: Boolean, default: true },
    flagEmail: { type: Boolean, default: false },
    cntFamMembers: { type: Number, default: 1 },
    daysBirth: { type: Number },

    creditScore: { type: Number, default: null },
    creditStage: { type: Number, enum: [1, 2, 3], default: 1 },

    //login related fields
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
