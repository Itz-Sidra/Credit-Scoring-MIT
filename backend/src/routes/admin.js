import express from "express";
import multer from "multer";
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
  getAlternateVaultKeys,
  attachAlternateVaultData,
  uploadVerifiedAlternateCsv,
} from "../controllers/adminController.js";

const router = express.Router();

const alternateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(protect, adminOnly);

router.get("/dashboard", getAdminDashboard);
router.get("/loans", getPendingLoans);
router.get("/my-loans", getMyLoans);
router.get("/my-loans/:loanId", getLoanByIdForAdmin);
router.get("/loans/:loanId/explainability", getLoanExplainabilityForAdmin);
router.get("/audit-logs", getAuditLogs);
router.patch("/loans/:loanId/approve", approveByAdmin);
router.patch("/loans/:loanId/reject", rejectByAdmin);
router.get("/alternate-vault-keys", getAlternateVaultKeys);
router.post("/loans/:loanId/alternate/vault", attachAlternateVaultData);
router.post(
  "/loans/:loanId/alternate/upload",
  alternateUpload.fields([
    { name: "upi", maxCount: 1 },
    { name: "utility", maxCount: 1 },
  ]),
  uploadVerifiedAlternateCsv
);

export default router;
