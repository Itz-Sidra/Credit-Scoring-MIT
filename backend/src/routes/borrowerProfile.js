import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  createProfile,
  getProfile,
  updateProfile,
} from "../controllers/borrowerProfileController.js";

const router = express.Router();

router.use(protect);

router.post("/", createProfile);
router.get("/", getProfile);
router.patch("/", updateProfile);

export default router;
