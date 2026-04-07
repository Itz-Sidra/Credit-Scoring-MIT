/**
 * Chroma Service  (Phase 6.5 — Node ↔ Python bridge)
 *
 * Calls the local Python chroma_query.py script via child_process and
 * returns parsed results.  This is the ONLY place in the Node backend
 * that talks to Chroma — all other code goes through this service.
 *
 * Public API:
 *   queryChroma(queryText, options?)  →  ChromaResult[]
 *
 * ChromaResult shape:
 *   { applicationId: string, score: number, distance: number, metadata: object }
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - No existing file modified.
 *  - Read-only — never writes to Chroma from Node.
 *  - If Python is unavailable or returns invalid JSON, returns [] gracefully.
 *  - query is passed as a CLI argument (not shell-interpolated) — no injection.
 */

import { spawnSync } from "child_process";
import path          from "path";
import { fileURLToPath } from "url";

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const QUERY_SCRIPT = path.resolve(__dirname, "../../ai/chroma_query.py");

// Timeout for the Python process (ms).  Embedding a query is fast (~1-2s).
const CHROMA_TIMEOUT_MS =
  Number(process.env.CHROMA_TIMEOUT_MS) || 30_000;

/**
 * Query Chroma for the top-k most semantically similar applicants.
 *
 * @param {string} queryText   - natural language query
 * @param {object} [options]
 * @param {number} [options.topK=5]         - max results
 * @param {string} [options.riskFilter]     - filter by riskLevel metadata
 * @param {string} [options.decisionFilter] - filter by decision metadata
 * @param {string} [options.borrowerFilter] - filter by borrowerType metadata
 * @param {string[]} [options.exclude]      - applicationIds to exclude
 *
 * @returns {Promise<Array<{applicationId:string, score:number, distance:number, metadata:object}>>}
 */
export async function queryChroma(queryText, options = {}) {
  const {
    topK           = 5,
    riskFilter     = null,
    decisionFilter = null,
    borrowerFilter = null,
    exclude        = [],
  } = options;

  if (!queryText || typeof queryText !== "string" || !queryText.trim()) {
    return [];
  }

  // Build CLI args — positional arg avoids any shell interpolation risk
  const args = [QUERY_SCRIPT, queryText.trim(), "--top", String(topK)];
  if (riskFilter)     args.push("--risk",     riskFilter);
  if (decisionFilter) args.push("--decision", decisionFilter);
  if (borrowerFilter) args.push("--borrower", borrowerFilter);
  if (exclude.length) args.push("--exclude",  exclude.filter(Boolean).join(","));

  let result;
  try {
    result = spawnSync("python3", args, {
      encoding:  "utf-8",
      timeout:   CHROMA_TIMEOUT_MS,
      maxBuffer: 5 * 1024 * 1024,   // 5MB — more than enough
    });
  } catch (spawnErr) {
    console.warn("[chromaService] spawnSync failed:", spawnErr.message);
    return [];
  }

  // Log stderr for debugging (never throws)
  if (result.stderr && result.stderr.trim()) {
    console.warn("[chromaService] python stderr:", result.stderr.trim());
  }

  if (result.status !== 0) {
    console.warn(`[chromaService] chroma_query.py exited with code ${result.status}`);
    return [];
  }

  const raw = (result.stdout || "").trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Normalise and validate each result
    return parsed
      .filter((r) => r && typeof r.applicationId === "string")
      .map((r) => ({
        applicationId: r.applicationId,
        score:         typeof r.score    === "number" ? r.score    : null,
        distance:      typeof r.distance === "number" ? r.distance : null,
        metadata:      r.metadata || {},
      }));
  } catch (parseErr) {
    console.warn("[chromaService] JSON parse error:", parseErr.message, "| raw:", raw.slice(0, 200));
    return [];
  }
}
