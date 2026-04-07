"""
test_chroma.py  —  Phase 6 self-contained verification
=======================================================
Tests the full Chroma layer in isolation: insert → query → cleanup.
Uses synthetic ApplicantCard data — no MongoDB or Ollama required.

Usage:
  python3 backend/ai/test_chroma.py

Expected output: all assertions pass, collection cleaned up.
Exit code 0 = success.
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Override persist dir to a temp location so tests don't pollute production data
os.environ["CHROMA_PERSIST_DIR"] = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "chroma_test_tmp"
)

from chroma_store import (
    upsert_documents,
    query_documents,
    delete_documents,
    collection_count,
    get_collection,
)
from chroma_sync  import sync_cards
from chroma_query import run_query

# ── Synthetic test data ───────────────────────────────────────────────────────

SYNTHETIC_CARDS = [
    {
        "applicationId": "aabbccdd00112233445566aa",
        "userId":        "user_001",
        "loanType":      "personal",
        "riskLevel":     "high",
        "decision":      "reject",
        "borrowerType":  "salaried",
        "occupation":    "software engineer",
        "userCategory":  "individual",
        "status":        "review",
        "preScreenStatus": "pass",
        "creditScore":   580,
        "probabilityOfDefault": 0.62,
        "summary": (
            "Ramesh Kumar applied for a personal loan of ₹2,50,000 over 36 months. "
            "Current application status is review. "
            "The ML scoring model assigned a credit score of 580, a high risk level, "
            "and a probability of default of 62.0%. System decision: reject. "
            "Eligible amount: ₹80,000. "
            "Top concerns: low credit score, high probability of default, high EMI burden. "
            "Occupation: software engineer. Borrower type: salaried."
        ),
    },
    {
        "applicationId": "bbccddee11223344556677bb",
        "userId":        "user_002",
        "loanType":      "home",
        "riskLevel":     "low",
        "decision":      "approve",
        "borrowerType":  "salaried",
        "occupation":    "government employee",
        "userCategory":  "individual",
        "status":        "approved",
        "preScreenStatus": "pass",
        "creditScore":   760,
        "probabilityOfDefault": 0.08,
        "summary": (
            "Priya Singh applied for a home loan of ₹35,00,000 over 240 months. "
            "Current application status is approved. "
            "The ML scoring model assigned a credit score of 760, a low risk level, "
            "and a probability of default of 8.0%. System decision: approve. "
            "Eligible amount: ₹35,00,000. "
            "Strengths: high credit score, low probability of default, verified identity. "
            "Occupation: government employee. Borrower type: salaried."
        ),
    },
    {
        "applicationId": "ccddeeff22334455667788cc",
        "userId":        "user_003",
        "loanType":      "business",
        "riskLevel":     "medium",
        "decision":      "hold",
        "borrowerType":  "msme",
        "occupation":    "business owner",
        "userCategory":  "business",
        "status":        "hold",
        "preScreenStatus": "pass",
        "creditScore":   640,
        "probabilityOfDefault": 0.33,
        "summary": (
            "Suresh Patel applied for a business loan of ₹8,00,000 over 60 months. "
            "Current application status is hold. "
            "The ML scoring model assigned a credit score of 640, a medium risk level, "
            "and a probability of default of 33.0%. System decision: hold. "
            "Eligible amount: ₹6,00,000. "
            "Concerns: missing GST registration, no UDYAM certificate, moderate EMI burden. "
            "Occupation: business owner. Borrower type: MSME."
        ),
    },
    {
        "applicationId": "ddeeff0033445566778899dd",
        "userId":        "user_004",
        "loanType":      "personal",
        "riskLevel":     "high",
        "decision":      "reject",
        "borrowerType":  "salaried",
        "occupation":    "sales executive",
        "userCategory":  "individual",
        "status":        "rejected",
        "preScreenStatus": "fail",
        "creditScore":   510,
        "probabilityOfDefault": 0.71,
        "summary": (
            "Anil Sharma applied for a personal loan of ₹1,50,000 over 24 months. "
            "Current application status is rejected. "
            "The ML scoring model assigned a credit score of 510, a high risk level, "
            "and a probability of default of 71.0%. System decision: reject. "
            "Pre-screen failed. "
            "Top concerns: very low credit score, no UPI transaction history, no bank account. "
            "Occupation: sales executive. Borrower type: salaried."
        ),
    },
    {
        "applicationId": "eeff001144556677889900ee",
        "userId":        "user_005",
        "loanType":      "personal",
        "riskLevel":     "high",
        "decision":      "reject",
        "borrowerType":  "farmer",
        "occupation":    "farmer",
        "userCategory":  "individual",
        "status":        "rejected",
        "preScreenStatus": "pass",
        "creditScore":   None,
        "probabilityOfDefault": 0.55,
        "summary": (
            "Kavita Devi applied for a personal loan of ₹50,000 over 12 months. "
            "Current application status is rejected. "
            "The ML scoring model assigned a high risk level "
            "and a probability of default of 55.0%. System decision: reject. "
            "Concerns: no formal credit history, insufficient collateral, identity not verified. "
            "Occupation: farmer. Borrower type: farmer."
        ),
    },
]

# ── Test helpers ──────────────────────────────────────────────────────────────

PASS = 0
FAIL = 0

def assertion(label: str, condition: bool, detail: str = ""):
    global PASS, FAIL
    if condition:
        print(f"  ✅  {label}")
        PASS += 1
    else:
        print(f"  ❌  {label}" + (f"  →  {detail}" if detail else ""))
        FAIL += 1


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_insert_single():
    print("\n── Test 1: Insert single card via sync_cards ──")
    result = sync_cards([SYNTHETIC_CARDS[0]])
    assertion("upserted == 1",  result["upserted"] == 1,  str(result))
    assertion("no errors",      len(result.get("errors", [])) == 0, str(result))
    assertion("collection_count >= 1", collection_count() >= 1)


def test_insert_multiple():
    print("\n── Test 2: Bulk upsert remaining 4 cards ──")
    result = sync_cards(SYNTHETIC_CARDS[1:])
    assertion("upserted == 4",  result["upserted"] == 4,  str(result))
    assertion("no errors",      len(result.get("errors", [])) == 0, str(result))
    assertion("total_in_collection == 5",
              result.get("total_in_collection") == 5, str(result))


def test_query_semantic():
    print("\n── Test 3: Semantic query — high risk salaried rejected ──")
    results = run_query("high risk salaried rejected applicant personal loan", top=3)
    assertion("returns 3 results",  len(results) == 3,  str(results))
    assertion("has applicationId",  all("applicationId" in r for r in results))
    assertion("has score",          all("score" in r for r in results))
    assertion("scores are floats",  all(isinstance(r["score"], float) for r in results))
    assertion("scores in [0, 1]",   all(0.0 <= r["score"] <= 1.0 for r in results))


def test_query_filtered():
    print("\n── Test 4: Filtered query — decision=reject ──")
    results = run_query("loan application issues", top=5, decision="reject")
    assertion("all decisions are reject",
              all(r["metadata"].get("decision") == "reject" for r in results),
              str([r["metadata"].get("decision") for r in results]))


def test_query_exclude():
    print("\n── Test 5: Exclude current applicant from results ──")
    target_id = SYNTHETIC_CARDS[0]["applicationId"]
    results = run_query("rejected salaried personal loan", top=5, exclude=[target_id])
    returned_ids = [r["applicationId"] for r in results]
    assertion("excluded ID not in results",
              target_id not in returned_ids, str(returned_ids))


def test_empty_summary_skipped():
    print("\n── Test 6: Card with empty summary is skipped gracefully ──")
    bad_card = {"applicationId": "ffffffffffffffffffffffff", "summary": ""}
    result = sync_cards([bad_card])
    assertion("upserted == 0",   result["upserted"] == 0)
    assertion("1 error recorded", len(result["errors"]) == 1)
    assertion("error mentions empty summary",
              "empty summary" in result["errors"][0].get("reason", "").lower(),
              str(result["errors"]))


def test_missing_id_skipped():
    print("\n── Test 7: Card with missing applicationId is skipped ──")
    bad_card = {"summary": "Some summary text without an ID."}
    result = sync_cards([bad_card])
    assertion("upserted == 0",   result["upserted"] == 0)
    assertion("1 error recorded", len(result["errors"]) == 1)


def test_json_output_parseable():
    print("\n── Test 8: query output is JSON-parseable (simulates Node usage) ──")
    results = run_query("identity verification issues", top=2)
    try:
        serialised = json.dumps(results)
        reparsed   = json.loads(serialised)
        assertion("serialise/deserialise round-trip works", reparsed == results)
    except Exception as e:
        assertion("serialise round-trip works", False, str(e))


def test_upsert_idempotent():
    print("\n── Test 9: Re-upserting same cards is idempotent (count unchanged) ──")
    count_before = collection_count()
    sync_cards(SYNTHETIC_CARDS[:2])
    count_after  = collection_count()
    assertion("count unchanged after re-upsert",
              count_before == count_after,
              f"before={count_before}, after={count_after}")


def cleanup():
    print("\n── Cleanup: Removing test documents ──")
    ids = [c["applicationId"] for c in SYNTHETIC_CARDS]
    result = delete_documents(ids)
    assertion(f"deleted {len(ids)} documents", result["deleted"] == len(ids))
    assertion("collection empty after cleanup", collection_count() == 0)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Phase 6 — Chroma Layer Test Suite")
    print("=" * 60)

    test_insert_single()
    test_insert_multiple()
    test_query_semantic()
    test_query_filtered()
    test_query_exclude()
    test_empty_summary_skipped()
    test_missing_id_skipped()
    test_json_output_parseable()
    test_upsert_idempotent()
    cleanup()

    print("\n" + "=" * 60)
    print(f"Results: {PASS} passed, {FAIL} failed ({PASS + FAIL} total)")
    print("=" * 60)
    sys.exit(0 if FAIL == 0 else 1)


if __name__ == "__main__":
    main()
