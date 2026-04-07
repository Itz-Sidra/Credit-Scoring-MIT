import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  applyForLoan,
  getMyLoans,
  getMyLoanById,
  acceptLoanOffer,
  declineLoanOffer,
} from "../controllers/loanController.js";
import { uploadAndAnalyzeDocument } from "../controllers/ocrController.js";

const router = express.Router();

router.use(protect);

router.post("/apply", applyForLoan);
router.get("/my-loans", getMyLoans);
router.get("/my-loans/:loanId", getMyLoanById);
router.patch("/:loanId/accept", acceptLoanOffer);
router.patch("/:loanId/decline", declineLoanOffer);

// ── OCR: additive document upload + Textract analysis ──────────────────────
router.post("/upload-document", uploadAndAnalyzeDocument);

export default router;
