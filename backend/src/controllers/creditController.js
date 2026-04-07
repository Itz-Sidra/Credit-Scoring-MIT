import User from "../models/User.js";
import { predictCreditScoreWithModel } from "../services/mlService.js";

function legacyScore(income, requestedAmount) {
  let creditScore;
  let riskLevel;

  if (income > 300000) {
    creditScore = 750;
    riskLevel = "low";
  } else if (income >= 150000 && income <= 300000) {
    creditScore = 600;
    riskLevel = "medium";
  } else {
    creditScore = 420;
    riskLevel = "high";
  }

  const eligibleAmount = Number((requestedAmount * 0.8).toFixed(2));
  const suggestedInterestRate =
    riskLevel === "low" ? 8.5 : riskLevel === "medium" ? 13.5 : 19.5;

  return {
    creditScore,
    riskLevel,
    eligibleAmount,
    suggestedInterestRate,
  };
}

export const predictCredit = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      gender,
      flagOwnCar,
      flagOwnRealty,
      cntChildren,
      incomTotal,
      amtCredit,
      goodsPrice,
      nameIncomeType,
      nameEducationType,
      nameContractType,
      daysEmployed,
      ownCarAge,
      flagMobile,
      flagEmail,
      cntFamMembers,
      daysBirth,
    } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.gender = gender;
    user.flagOwnCar = flagOwnCar;
    user.flagOwnRealty = flagOwnRealty;
    user.cntChildren = cntChildren;
    user.incomTotal = incomTotal;
    user.amtCredit = amtCredit;
    user.goodsPrice = goodsPrice;
    user.nameIncomeType = nameIncomeType;
    user.nameEducationType = nameEducationType;
    user.nameContractType = nameContractType;
    user.daysEmployed = daysEmployed;
    user.ownCarAge = ownCarAge;
    user.flagMobile = flagMobile;
    user.flagEmail = flagEmail;
    user.cntFamMembers = cntFamMembers;
    user.daysBirth = daysBirth;

    const income = Number(incomTotal);
    const requestedAmount = Number(amtCredit);

    let scoring;
    let scoringSource = "ml_model";

    try {
      const modelResult = await predictCreditScoreWithModel(req.body);
      const eligibleAmount = Number((requestedAmount * 0.8).toFixed(2));
      const suggestedInterestRate =
        modelResult.riskLevel === "low"
          ? 8.5
          : modelResult.riskLevel === "medium"
            ? 13.5
            : 19.5;

      scoring = {
        creditScore: modelResult.creditScore,
        riskLevel: modelResult.riskLevel,
        eligibleAmount,
        suggestedInterestRate,
        probability: modelResult.probability,
        modelInfo: modelResult.modelInfo,
      };
    } catch (mlError) {
      scoring = legacyScore(income, requestedAmount);
      scoringSource = "legacy_fallback";
      scoring.mlError = mlError.message;
    }

    user.creditScore = scoring.creditScore;
    await user.save();

    return res.status(200).json({
      creditScore: scoring.creditScore,
      riskLevel: scoring.riskLevel,
      eligibleAmount: scoring.eligibleAmount,
      suggestedInterestRate: scoring.suggestedInterestRate,
      probability: scoring.probability,
      modelInfo: scoring.modelInfo,
      scoringSource,
      ...(scoring.mlError ? { mlError: scoring.mlError } : {}),
      message:
        scoringSource === "ml_model"
          ? "Score generated successfully (winner upgrade v5)"
          : "Score generated with legacy fallback",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error generating credit score", error: error.message });
  }
};

export default predictCredit;
