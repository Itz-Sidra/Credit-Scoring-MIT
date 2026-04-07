import { processCopilotQuery } from "../services/chatHandlerService.js";
import LoanApplication from "../models/LoanApplication.js";

/**
 * POST /api/chat
 * Body: { query: string, applicationId?: string }
 */
export async function handleChatRequest(req, res) {
  const { query, applicationId } = req.body;

  // ── Validate ────────────────────────────────────────────────────────────
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({
      success: false,
      error: "query is required and must be a non-empty string",
    });
  }

  const trimmedQuery = query.trim();

  console.log(`[chat] incoming query="${trimmedQuery.slice(0, 80)}" appId=${applicationId ?? "none"}`);

  // Resolve applicationId:
  //  - If caller passes a MongoDB _id, use it as-is.
  //  - If caller passes a human-readable loanCode like "P12", look up the loan and
  //    substitute its _id so downstream handlers can work consistently.
  let effectiveApplicationId = applicationId || null;
  if (typeof applicationId === "string" && applicationId.trim()) {
    const raw = applicationId.trim();
    const looksLikeLoanCode = /^[A-Za-z][0-9]+$/.test(raw);
    if (looksLikeLoanCode) {
      try {
        const loan = await LoanApplication.findOne({ loanCode: raw.toUpperCase() }).select("_id loanCode");
        if (loan) {
          effectiveApplicationId = loan._id.toString();
          console.log(`[chat] resolved loanCode ${raw} → applicationId=${effectiveApplicationId}`);
        } else {
          console.warn(`[chat] no loan found for loanCode=${raw}`);
        }
      } catch (lookupError) {
        console.warn(`[chat] error looking up loanCode ${raw}:`, lookupError.message);
      }
    }
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────
  try {
    const response = await processCopilotQuery({
      query: trimmedQuery,
      applicationId: effectiveApplicationId,
    });

    console.log(`[chat] intent=${response.intent}  contextType=${response.contextType}`);

    // Strip internal routing debug field from public response
    const { routedQuery: _routedQuery, ...publicResponse } = response;

    return res.status(200).json({
      success: true,
      data: publicResponse,
    });
  } catch (err) {
    console.error("[chat] handler error:", err);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred while processing your query.",
    });
  }
}
