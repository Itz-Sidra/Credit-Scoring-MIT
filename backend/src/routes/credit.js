import express from "express";
import { protect } from "../middlewares/auth.js";
import predictCredit from "../controllers/creditController.js";

const router = express.Router();

router.post("/predict", protect, predictCredit);

export default router;
