import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  getDashboard,
  getProfile,
  getInsights,
  getTransactions,
  getEligibility,
  getAcitveLoans,
  changePassword,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/profile", protect, getProfile);
router.get("/dashboard", protect, getDashboard);
router.get("/insights", protect, getInsights);
router.get("/transactions", protect, getTransactions);
router.get("/loans/active", protect, getAcitveLoans);
router.get("/eligibility", protect, getEligibility);
router.put("/change-password", protect, changePassword);

export default router;
