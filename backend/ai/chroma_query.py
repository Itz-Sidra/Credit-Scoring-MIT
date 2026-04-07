"""
chroma_query.py  —  Phase 6 semantic retrieval from Chroma
===========================================================
Query the local `applicant_cards` Chroma collection and return the
top-k most semantically similar applicants as JSON.

Node backend calls this script and parses stdout:
  python3 backend/ai/chroma_query.py "high risk salaried rejected applicant"

Options:
  --top         Number of results to return  (default: 5)
  --risk        Filter by riskLevel metadata
  --decision    Filter by decision metadata
  --borrower    Filter by borrowerType metadata
  --exclude     Comma-separated applicationId(s) to exclude from results
                (use this to exclude the applicant currently being viewed)

Output (stdout, JSON array):
  [
    {
      "applicationId": "...",
      "score":         0.87,      // cosine similarity, 0-1
      "distance":      0.13,
      "document":      "...",
      "metadata": { "riskLevel": "high", "decision": "reject", ... }
    },
    ...
  ]

Exit codes:
  0 — success (results printed)
  1 — error (message printed to stderr, empty array to stdout)

SAFE INTEGRATION GUARANTEE
  - Read-only query — never modifies Chroma or MongoDB.
  - Node parses stdout JSON; stderr is ignored in production.
"""

import sys
import json
import os
import argparse
from typing import Optional, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from typing import Optional, List, Dict
from chroma_store import query_documents, collection_count


# ── Filter builder ────────────────────────────────────────────────────────────

def _build_where(risk: Optional[str], decision: Optional[str], borrower: Optional[str]) -> Optional[Dict]:
    """
    Constructs a Chroma $and / single-field where clause from CLI filters.
    Returns None if no filters are provided.
    """
    conditions = []
    if risk:
        conditions.append({"riskLevel": {"$eq": risk}})
    if decision:
        conditions.append({"decision": {"$eq": decision}})
    if borrower:
        conditions.append({"borrowerType": {"$eq": borrower}})

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}


# ── Result post-processing ────────────────────────────────────────────────────

def _exclude_ids(results: List[Dict], exclude: List[str]) -> List[Dict]:
    """Remove results whose applicationId is in the exclude list."""
    if not exclude:
        return results
    exclude_set = set(e.strip().lower() for e in exclude)
    return [r for r in results if r["applicationId"].lower() not in exclude_set]


# ── Main query function ───────────────────────────────────────────────────────

def run_query(
    query_text: str,
    top:        int             = 5,
    risk:       Optional[str]  = None,
    decision:   Optional[str]  = None,
    borrower:   Optional[str]  = None,
    exclude:    Optional[List[str]] = None,
) -> List[Dict]:
    """
    Execute a semantic similarity query against the Chroma collection.

    Returns a list of result dicts (see module docstring for shape).
    Returns [] with a warning if collection is empty.
    """
    count = collection_count()
    if count == 0:
        # Return structured empty result — Node can handle this gracefully
        return []

    where = _build_where(risk, decision, borrower)

    # Request more than needed so we have room to exclude IDs after filtering
    fetch_n = min(top + len(exclude or []) + 5, count)

    results = query_documents(
        query_text=query_text,
        n_results=fetch_n,
        where=where,
    )

    results = _exclude_ids(results, exclude or [])
    return results[:top]


# ── CLI entry point ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Query Chroma for semantically similar applicants."
    )
    parser.add_argument("query",
        help="Natural language query, e.g. 'high risk salaried rejected applicant'")
    parser.add_argument("--top",      type=int, default=5,
        help="Number of results to return (default: 5)")
    parser.add_argument("--risk",     default=None,
        help="Filter by riskLevel (e.g. 'high', 'medium', 'low')")
    parser.add_argument("--decision", default=None,
        help="Filter by decision (e.g. 'reject', 'approve', 'hold')")
    parser.add_argument("--borrower", default=None,
        help="Filter by borrowerType (e.g. 'salaried', 'msme', 'farmer')")
    parser.add_argument("--exclude",  default="",
        help="Comma-separated applicationId(s) to exclude from results")

    args = parser.parse_args()

    exclude = [e for e in args.exclude.split(",") if e.strip()] if args.exclude else []

    try:
        results = run_query(
            query_text=args.query,
            top=args.top,
            risk=args.risk,
            decision=args.decision,
            borrower=args.borrower,
            exclude=exclude,
        )
        print(json.dumps(results, ensure_ascii=False, indent=2))
        sys.exit(0)

    except Exception as e:
        print(json.dumps([], ensure_ascii=False), flush=True)
        print(f"[chroma_query] Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
