import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  adminOnly,
  getPendingLoans,
  getAdminDashboard,
  approveByAdmin,
  rejectByAdmin,
  getMyLoans,
  getAuditLogs,
  getLoanByIdForAdmin,
  getLoanExplainabilityForAdmin,
} from "../controllers/adminController.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/dashboard", getAdminDashboard);
router.get("/loans", getPendingLoans);
router.get("/my-loans", getMyLoans);
router.get("/my-loans/:loanId", getLoanByIdForAdmin);
router.get("/loans/:loanId/explainability", getLoanExplainabilityForAdmin);
router.get("/audit-logs", getAuditLogs);
router.patch("/loans/:loanId/approve", approveByAdmin);
router.patch("/loans/:loanId/reject", rejectByAdmin);

export default router;
