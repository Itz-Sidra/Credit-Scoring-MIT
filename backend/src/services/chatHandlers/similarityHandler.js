/**
 * Similarity Handler  (Phase 6.5 — Real Chroma Retrieval)
 * Intent: similar_applicants
 *
 * Flow:
 *  1. Fetch base ApplicantCard (if applicationId provided)
 *  2. Build a semantic query string from the card's key signals
 *  3. Query Chroma for top-K similar applicant IDs
 *  4. Fetch full ApplicantCards for each result from MongoDB
 *  5. Optionally ask Qwen to summarise the pattern
 *  6. Return structured response
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Only calls Phase 2 fetch + Phase 3 Ollama + Phase 6.5 Chroma services.
 *  - No existing file modified.
 *  - MongoDB remains source of truth — Chroma only provides IDs.
 */

import { getApplicantCardByApplicationId } from "../applicantFetchService.js";
import { queryChroma }                      from "../chromaService.js";
import { askGroundedCopilot }               from "../ollamaService.js";

const TOP_K = 5;

// ── Query string builder ──────────────────────────────────────────────────────

/**
 * Converts the base ApplicantCard into a rich semantic query string for Chroma.
 * Mirrors the language used in applicantSummaryService so cosine similarity is high.
 */
function buildSemanticQuery(card, routedQuery) {
  const parts = [];

  if (card.riskLevel)    parts.push(`${card.riskLevel} risk`);
  if (card.borrowerType) parts.push(card.borrowerType);
  if (card.loanType)     parts.push(`${card.loanType} loan`);
  if (card.decision)     parts.push(`decision ${card.decision}`);
  if (card.occupation)   parts.push(card.occupation);
  if (card.incomeType)   parts.push(card.incomeType);

  if (card.amlFlags?.length)
    parts.push(`flags ${card.amlFlags.join(" ")}`);
  if (card.topNegativeFactors?.length)
    parts.push(card.topNegativeFactors.slice(0, 2).join(" "));

  if (card.probabilityOfDefault != null) {
    const pdPct = (card.probabilityOfDefault * 100).toFixed(0);
    parts.push(`probability of default ${pdPct}%`);
  }
  if (card.creditScore != null)
    parts.push(`credit score ${card.creditScore}`);

  // Fallback: use the router's normalised query if card has very few signals
  if (parts.length < 3 && routedQuery?.normalizedQuery) {
    parts.push(routedQuery.normalizedQuery);
  }

  return parts.join(" ").trim() || "loan applicant risk assessment";
}

// ── Context formatter for Qwen ────────────────────────────────────────────────

function buildSimilarityContext(baseCard, similarCards) {
  const lines = [];

  lines.push("=== Base Applicant ===");
  lines.push(`Application ID: ${baseCard.applicationId}`);
  lines.push(`Risk Level: ${baseCard.riskLevel ?? "N/A"} | Decision: ${baseCard.decision ?? "N/A"} | PD: ${baseCard.probabilityOfDefault != null ? (baseCard.probabilityOfDefault * 100).toFixed(1) + "%" : "N/A"}`);
  lines.push(`Borrower Type: ${baseCard.borrowerType ?? "N/A"} | Loan Type: ${baseCard.loanType ?? "N/A"}`);
  if (baseCard.topNegativeFactors?.length)
    lines.push(`Key Concerns: ${baseCard.topNegativeFactors.join("; ")}`);

  lines.push("\n=== Similar Applicants ===");
  similarCards.forEach((card, i) => {
    lines.push(`\n[${i + 1}] Application ID: ${card.applicationId}`);
    lines.push(`    Risk: ${card.riskLevel ?? "N/A"} | Decision: ${card.decision ?? "N/A"} | PD: ${card.probabilityOfDefault != null ? (card.probabilityOfDefault * 100).toFixed(1) + "%" : "N/A"}`);
    lines.push(`    Borrower Type: ${card.borrowerType ?? "N/A"} | Loan Type: ${card.loanType ?? "N/A"}`);
    if (card.topNegativeFactors?.length)
      lines.push(`    Concerns: ${card.topNegativeFactors.join("; ")}`);
  });

  return lines.join("\n");
}

// ── Fallback structured answer (no Qwen) ─────────────────────────────────────

function buildFallbackAnswer(baseCard, similarCards, chromaResults) {
  const lines = [];

  if (baseCard) {
    lines.push(`Base applicant (${baseCard.applicationId}): ${baseCard.riskLevel ?? "unknown"} risk, decision=${baseCard.decision ?? "pending"}`);
    lines.push("");
  }

  lines.push(`Found ${similarCards.length} similar applicant(s):`);
  similarCards.forEach((card, i) => {
    const score = chromaResults[i]?.score != null
      ? ` (similarity: ${(chromaResults[i].score * 100).toFixed(0)}%)`
      : "";
    lines.push(`  ${i + 1}. ${card.applicationId}${score} — ${card.riskLevel ?? "?"} risk, ${card.decision ?? "pending"}, ${card.borrowerType ?? "?"} borrower`);
    if (card.topNegativeFactors?.length)
      lines.push(`     Concerns: ${card.topNegativeFactors.slice(0, 2).join("; ")}`);
  });

  return lines.join("\n");
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * @param {string|null} applicationId
 * @param {object}      routedQuery
 * @returns {object} standardised handler response
 */
export async function similarityHandler(applicationId, routedQuery) {
  // ── Step 1: Fetch base card if we have an ID ──────────────────────────────
  let baseCard = null;
  if (applicationId) {
    try {
      baseCard = await getApplicantCardByApplicationId(applicationId);
    } catch (err) {
      // Non-fatal — we can still run a freetext Chroma query
      console.warn("[similarityHandler] Base card fetch failed:", err.message);
    }
  }

  // ── Step 2: Build semantic query ──────────────────────────────────────────
  const queryText = baseCard
    ? buildSemanticQuery(baseCard, routedQuery)
    : (routedQuery?.normalizedQuery || "similar loan applicant risk");

  // ── Step 3: Query Chroma ──────────────────────────────────────────────────
  const chromaResults = await queryChroma(queryText, {
    topK:    TOP_K,
    exclude: baseCard ? [baseCard.applicationId] : [],
  });

  if (!chromaResults.length) {
    return {
      intent: "similar_applicants",
      answer:
        "No similar applicants found in the vector index. " +
        (baseCard
          ? "This may be the only application with this risk profile in the current dataset."
          : "Try specifying an application ID for a more targeted similarity search."),
      sources:     baseCard ? [baseCard.applicationId] : [],
      contextType: "unsupported",
      metadata:    { reason: "no_chroma_results", queryText },
    };
  }

  // ── Step 4: Resolve IDs back to full ApplicantCards from MongoDB ──────────
  const similarCards = [];
  for (const cr of chromaResults) {
    try {
      const card = await getApplicantCardByApplicationId(cr.applicationId);
      if (card) similarCards.push(card);
    } catch {
      // Skip any card that fails to load — don't abort the whole response
    }
  }

  if (!similarCards.length) {
    return {
      intent: "similar_applicants",
      answer: "Similar application IDs were found in the index but could not be resolved from the database. The index may be out of sync — re-run `npm run chroma:sync`.",
      sources:     baseCard ? [baseCard.applicationId] : [],
      contextType: "unsupported",
      metadata:    { reason: "mongo_resolution_failed", chromaResults },
    };
  }

  const allSources = [
    ...(baseCard ? [baseCard.applicationId] : []),
    ...similarCards.map((c) => c.applicationId),
  ];

  // ── Step 5: Ask Qwen to summarise patterns (optional, degrades gracefully) ─
  let answer;
  try {
    const context  = buildSimilarityContext(baseCard || similarCards[0], similarCards);
    const question = baseCard
      ? "Identify the common risk patterns and key similarities between the base applicant and the similar applicants listed. What do they share in terms of risk profile, weaknesses, or income characteristics?"
      : "Summarise the common risk patterns, loan types, and weaknesses across these similar applicants.";

    answer = await askGroundedCopilot({ question, context, intent: "similar_applicants" });
  } catch (err) {
    if (err.isOllamaUnavailable) {
      answer = buildFallbackAnswer(baseCard, similarCards, chromaResults) +
               "\n\n[AI pattern summary unavailable — Ollama is not reachable]";
    } else {
      answer = buildFallbackAnswer(baseCard, similarCards, chromaResults);
    }
  }

  return {
    intent: "similar_applicants",
    answer,
    sources: allSources,
    contextType: "comparison",
    metadata: {
      baseApplicationId:  baseCard?.applicationId ?? null,
      similarCount:       similarCards.length,
      queryText,
      topScores:          chromaResults.slice(0, similarCards.length).map((r) => ({
        applicationId: r.applicationId,
        score:         r.score,
      })),
    },
  };
}

