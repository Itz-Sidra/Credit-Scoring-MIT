/**
 * Chat Handler Service  (Phase 5 — Central Orchestrator)
 *
 * This is the single internal entry point for the Barclays Copilot chatbot engine.
 *
 * Accepts a raw user query + optional applicationId override, routes it through
 * the Phase 4 Query Router, and dispatches to the correct Phase 5 handler.
 *
 * Public API:
 *   processCopilotQuery({ query, applicationId? })  → HandlerResponse
 *
 * HandlerResponse shape:
 * {
 *   intent:      string,
 *   answer:      string,
 *   sources:     string[],
 *   contextType: "applicant_card" | "comparison" | "portfolio_analytics" | "unsupported",
 *   metadata:    object,
 *   routedQuery: object   (Phase 4 result — useful for debugging)
 * }
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Only imports from new Phase 2–5 services.
 *  - No existing file modified.
 *  - No DB access in this file — all DB calls are inside individual handlers.
 */

import { routeQuery, INTENTS }  from "./queryRouterService.js";

import { lookupHandler }      from "./chatHandlers/lookupHandler.js";
import { riskHandler }        from "./chatHandlers/riskHandler.js";
import { improvementHandler } from "./chatHandlers/improvementHandler.js";
import { comparisonHandler }  from "./chatHandlers/comparisonHandler.js";
import { similarityHandler }  from "./chatHandlers/similarityHandler.js";
import { analyticsHandler }   from "./chatHandlers/analyticsHandler.js";

// ── Unsupported fallback ──────────────────────────────────────────────────────

function unsupportedResponse(routedQuery) {
  return {
    intent: "unsupported_query",
    answer:
      "I can only assist with applicant analysis, decision support, and portfolio insights within the C.R.E.D.I.T system. " +
      "Try asking about a specific application, a risk decision, improvement suggestions, or portfolio statistics.",
    sources: [],
    contextType: "unsupported",
    metadata: { normalizedQuery: routedQuery?.normalizedQuery },
  };
}

// ── Intent → Handler dispatch map ────────────────────────────────────────────

const HANDLER_MAP = {
  [INTENTS.APPLICANT_LOOKUP]:       lookupHandler,
  [INTENTS.RISK_EXPLANATION]:       riskHandler,
  [INTENTS.IMPROVEMENT_SUGGESTION]: improvementHandler,
  [INTENTS.COMPARISON]:             comparisonHandler,
  [INTENTS.SIMILAR_APPLICANTS]:     similarityHandler,
  [INTENTS.AGGREGATE_INSIGHT]:      analyticsHandler,
};

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Processes a single admin copilot query end-to-end.
 *
 * @param {object} params
 * @param {string} params.query           - raw natural language query from the admin
 * @param {string} [params.applicationId] - optional explicit applicationId override
 *                                          (e.g. from UI context / currently-open card)
 * @returns {Promise<object>} HandlerResponse
 */
export async function processCopilotQuery({ query, applicationId = null }) {
  if (!query || typeof query !== "string" || !query.trim()) {
    return {
      intent: "unsupported_query",
      answer: "Please enter a question or request.",
      sources: [],
      contextType: "unsupported",
      metadata: { reason: "empty_query" },
      routedQuery: null,
    };
  }

  // ── Phase 4: Route the query ──────────────────────────────────────────────
  let routedQuery = routeQuery(query);

  // If the router fell through to unsupported but the admin already selected an
  // application and the question is clearly about profile facts, treat as lookup.
  const q = routedQuery.normalizedQuery || "";
  const profileFactHints =
    /\b(income|salary|earn|earning|earnings|revenue|turnover|occupation|employment|job|business owner|business type|self[- ]employ|borrower|applicant type|salaried|msme|farmer)\b/;
  if (
    routedQuery.intent === INTENTS.UNSUPPORTED_QUERY &&
    applicationId &&
    profileFactHints.test(q)
  ) {
    routedQuery = {
      ...routedQuery,
      intent: INTENTS.APPLICANT_LOOKUP,
      confidence: "medium",
    };
  }

  // Resolve effective applicationId:
  //  1. Explicit override from caller (e.g. UI sends currently-open card ID)
  //  2. Extracted by Phase 4 router from the query text
  const effectiveApplicationId =
    applicationId ||
    routedQuery.entities?.applicationIdA ||
    routedQuery.applicationId ||
    null;

  // ── Phase 5: Dispatch to correct handler ──────────────────────────────────
  const handler = HANDLER_MAP[routedQuery.intent];

  let handlerResult;
  if (!handler) {
    handlerResult = unsupportedResponse(routedQuery);
  } else {
    try {
      handlerResult = await handler(effectiveApplicationId, routedQuery);
    } catch (err) {
      // All handlers should catch their own errors, but this is a safety net
      console.error(
        `[chatHandlerService] Unhandled error in handler for intent "${routedQuery.intent}":`,
        err
      );
      handlerResult = {
        intent: routedQuery.intent,
        answer: `An unexpected error occurred while processing your request. Please try again.`,
        sources: [],
        contextType: "unsupported",
        metadata: { error: err.message },
      };
    }
  }

  // Attach routedQuery for transparency / debugging (API layer can strip this)
  return {
    ...handlerResult,
    routedQuery: {
      intent:          routedQuery.intent,
      applicationId:   routedQuery.applicationId,
      entities:        routedQuery.entities,
      normalizedQuery: routedQuery.normalizedQuery,
      confidence:      routedQuery.confidence,
    },
  };
}
