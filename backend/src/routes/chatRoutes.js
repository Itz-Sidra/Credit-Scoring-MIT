import { Router } from "express";
import { handleChatRequest } from "../controllers/chatController.js";

const router = Router();

// POST /api/chat
router.post("/chat", handleChatRequest);

export default router;
