/**
 * chromaExport.js  —  Node bridge: MongoDB → Chroma sync
 * ========================================================
 * Fetches ApplicantCards from MongoDB and pipes them as JSON to
 * backend/ai/chroma_sync.py, which upserts them into Chroma.
 *
 * Usage (from workspace root):
 *   node backend/scripts/chromaExport.js
 *   node backend/scripts/chromaExport.js --limit 50
 *   node backend/scripts/chromaExport.js --id <applicationId>
 *
 * Requires: backend/.env  (MONGO_URI)
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Read-only MongoDB queries via existing Phase 2 fetch service.
 *  - Does NOT modify any existing backend file.
 */

import path      from "path";
import { fileURLToPath } from "url";
import { spawnSync }     from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dotenv    = await import("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import mongoose from "mongoose";
import {
  getApplicantCardByApplicationId,
  getAllApplicantCards,
} from "../src/services/applicantFetchService.js";

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const idIdx    = args.indexOf("--id");

const LIMIT     = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 200;
const SINGLE_ID = idIdx    !== -1 ? args[idIdx + 1] : null;

// ── Connect ───────────────────────────────────────────────────────────────────
const uri = process.env.MONGO_URI;
if (!uri) { console.error("❌  MONGO_URI not set in backend/.env"); process.exit(1); }
await mongoose.connect(uri);
console.error(`✅  MongoDB connected`);

// ── Fetch cards ───────────────────────────────────────────────────────────────
let cards;
if (SINGLE_ID) {
  console.error(`🔍  Fetching single card: ${SINGLE_ID}`);
  const card = await getApplicantCardByApplicationId(SINGLE_ID);
  if (!card) {
    console.error(`❌  Application ${SINGLE_ID} not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  cards = [card];
} else {
  console.error(`🔍  Fetching up to ${LIMIT} applicant cards from MongoDB…`);
  cards = await getAllApplicantCards({ limit: LIMIT, skip: 0 });
  console.error(`   Found ${cards.length} cards`);
}

await mongoose.disconnect();
console.error(`✅  MongoDB disconnected`);

if (!cards.length) {
  console.error("⚠️   No cards to sync.");
  process.exit(0);
}

// ── Pipe to Python sync script ────────────────────────────────────────────────
const syncScript = path.resolve(__dirname, "../ai/chroma_sync.py");
const json       = JSON.stringify(cards);

console.error(`🐍  Calling chroma_sync.py with ${cards.length} card(s)…`);

const result = spawnSync("python3", [syncScript], {
  input:  json,
  encoding: "utf-8",
  maxBuffer: 50 * 1024 * 1024,   // 50MB — safe for large exports
});

if (result.status !== 0 && result.status !== 2) {
  console.error("❌  chroma_sync.py failed:");
  if (result.stderr) console.error(result.stderr);
  process.exit(1);
}

if (result.stderr) console.error(result.stderr.trim());

// Print the sync result JSON from Python to stdout
console.log(result.stdout.trim());

if (result.status === 2) {
  console.error("⚠️   Some cards had errors (see 'errors' field above). Exit 2.");
  process.exit(2);
}
process.exit(0);
