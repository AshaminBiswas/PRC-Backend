import { Router } from "express";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { copilotChat, draftReply, generateReport } from "./ai-agent.controller";

const router = Router();

// All AI Agent endpoints require admin authentication
router.use(authenticate);
// Super admin, admin, manager or staff can use the AI copilot
router.use(authorize("ai.use", "products.read", "orders.read"));

// POST /api/v1/ai-agent/chat           – General admin copilot chat
router.post("/chat", copilotChat);

// POST /api/v1/ai-agent/draft-reply    – AI-drafted PO email reply
router.post("/draft-reply", draftReply);

// POST /api/v1/ai-agent/report         – AI-generated business report
router.post("/report", generateReport);

export default router;
