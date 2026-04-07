/**
 * Applicant Fetch Service  (Phase 1 + Phase 2)
 *
 * Fetches LoanApplication + linked User from MongoDB and returns
 * clean ApplicantCards using the Phase 1 Card Builder.
 *
 * Public API:
 *   validateObjectId(id)                          — guards all queries
 *   getApplicantCardByApplicationId(id)           — primary exact lookup
 *   getLatestApplicantCardByUserId(userId)        — most-recent loan for a user
 *   getAllApplicantCardsByUserId(userId)           — all loans for a user
 *   getAllApplicantCards(opts)                     — paginated bulk for Chroma sync
 *   getApplicantRawContextByApplicationId(id)     — raw docs for deep debugging
 *
 * SAFE INTEGRATION GUARANTEE:
 *  - Read-only .find() / .findById() + .lean() queries only.
 *  - Does NOT import or call any existing controller, route, or ML service.
 *  - Does NOT modify any document.
 *  - Never exposes password, loginAttempts, lockedUntil, or other auth fields.
 */

import mongoose from "mongoose";
import LoanApplication from "../models/LoanApplication.js";
import User            from "../models/User.js";
import { buildApplicantCard } from "./applicantCardService.js";

// Projected user fields — intentionally minimal; NO auth/security fields ever
const USER_PROJECTION =
  "fullName email phone phoneVerified emailVerified creditScore gender";

// ── ID validation ─────────────────────────────────────────────────────────────

/**
 * Returns true if `id` is a valid 24-char hex MongoDB ObjectId string.
 * Use this before every query to avoid CastError bubbling up to routes.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Fetch an ApplicantCard by LoanApplication _id.
 *
 * @param {string} applicationId - MongoDB ObjectId string
 * @returns {object|null} ApplicantCard or null if not found
 * @throws {Error} if applicationId is not a valid ObjectId
 */
export async function getApplicantCardByApplicationId(applicationId) {
  if (!validateObjectId(applicationId)) {
    throw new Error(`Invalid application ID format: ${applicationId}`);
  }

  const loan = await LoanApplication.findById(applicationId)
    .populate("userId", USER_PROJECTION)
    .lean();

  if (!loan) return null;

  const resolvedUser = _extractPopulatedUser(loan.userId);
  return buildApplicantCard(loan, resolvedUser);
}

/**
 * Fetch the most-recent ApplicantCard for a given user ID.
 * Alias: getLatestApplicantCardByUserId (Phase 2 canonical name).
 *
 * @param {string} userId - MongoDB ObjectId string
 * @returns {object|null} ApplicantCard or null if no loan found
 * @throws {Error} if userId is not a valid ObjectId
 */
export async function getLatestApplicantCardByUserId(userId) {
  if (!validateObjectId(userId)) {
    throw new Error(`Invalid user ID format: ${userId}`);
  }

  const loan = await LoanApplication.findOne({ userId })
    .sort({ submittedAt: -1 })
    .populate("userId", USER_PROJECTION)
    .lean();

  if (!loan) return null;

  const resolvedUser = _extractPopulatedUser(loan.userId);
  return buildApplicantCard(loan, resolvedUser);
}

// Backward-compat alias (Phase 1 name)
export const getApplicantCardByUserId = getLatestApplicantCardByUserId;

/**
 * Fetch ALL ApplicantCards for a specific user (all their loan applications),
 * sorted newest-first.
 *
 * @param {string} userId - MongoDB ObjectId string
 * @returns {object[]} Array of ApplicantCards (may be empty)
 * @throws {Error} if userId is not a valid ObjectId
 */
export async function getAllApplicantCardsByUserId(userId) {
  if (!validateObjectId(userId)) {
    throw new Error(`Invalid user ID format: ${userId}`);
  }

  const loans = await LoanApplication.find({ userId })
    .sort({ submittedAt: -1 })
    .populate("userId", USER_PROJECTION)
    .lean();

  const cards = [];
  for (const loan of loans) {
    try {
      const resolvedUser = _extractPopulatedUser(loan.userId);
      cards.push(buildApplicantCard(loan, resolvedUser));
    } catch (err) {
      console.warn(
        `[applicantFetchService] Skipped loan ${loan._id} for user ${userId} — build failed: ${err.message}`
      );
    }
  }
  return cards;
}

/**
 * Return the raw LoanApplication + raw User documents for deep debugging
 * or future context assembly beyond the card abstraction.
 *
 * SECURITY: User document is returned with the safe USER_PROJECTION only —
 * password, loginAttempts, lockedUntil, and other auth fields are never included.
 *
 * @param {string} applicationId
 * @returns {{ loan: object, user: object|null }|null}
 * @throws {Error} if applicationId is not a valid ObjectId
 */
export async function getApplicantRawContextByApplicationId(applicationId) {
  if (!validateObjectId(applicationId)) {
    throw new Error(`Invalid application ID format: ${applicationId}`);
  }

  const loan = await LoanApplication.findById(applicationId)
    .populate("userId", USER_PROJECTION)
    .lean();

  if (!loan) return null;

  const resolvedUser = _extractPopulatedUser(loan.userId);

  // If populated object is not available, try a direct user lookup
  let user = resolvedUser;
  if (!user && loan.userId) {
    const rawUserId = String(loan.userId);
    if (validateObjectId(rawUserId)) {
      user = await User.findById(rawUserId)
        .select(USER_PROJECTION)
        .lean();
    }
  }

  return { loan, user: user || null };
}

/**
 * Paginated bulk fetch — used by Chroma sync (Phase 6).
 * Fetches across ALL users with an optional Mongo filter.
 * For per-user bulk fetch, use getAllApplicantCardsByUserId() instead.
 *
 * @param {object} [opts]
 * @param {number} [opts.limit=100]
 * @param {number} [opts.skip=0]
 * @param {object} [opts.filter={}] - optional Mongo query filter
 * @returns {object[]} Array of ApplicantCards
 */
export async function getAllApplicantCards({ limit = 100, skip = 0, filter = {} } = {}) {
  const loans = await LoanApplication.find(filter)
    .sort({ submittedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("userId", USER_PROJECTION)
    .lean();

  const cards = [];
  for (const loan of loans) {
    try {
      const resolvedUser = _extractPopulatedUser(loan.userId);
      cards.push(buildApplicantCard(loan, resolvedUser));
    } catch (err) {
      // One bad document should not abort the full batch
      console.warn(
        `[applicantFetchService] Skipped loan ${loan._id} — card build failed: ${err.message}`
      );
    }
  }
  return cards;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * After .lean() + .populate(), userId is either a plain object (populated)
 * or a raw ObjectId (not populated / null). Extract the user object safely.
 */
function _extractPopulatedUser(userId) {
  if (
    userId &&
    typeof userId === "object" &&
    (userId.fullName || userId.email)
  ) {
    return userId;
  }
  return null;
}
