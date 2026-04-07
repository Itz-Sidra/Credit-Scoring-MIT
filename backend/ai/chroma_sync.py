"""
chroma_sync.py  —  Phase 6 Applicant Card sync into Chroma
===========================================================
Reads ApplicantCard objects (exported by Node) and upserts them into
the local Chroma `applicant_cards` collection.

Integration pattern
-------------------
Node exports flat ApplicantCard JSON  →  pipes to Python stdin
  echo '[{...card...}]' | python3 backend/ai/chroma_sync.py

Or pass a JSON file path as the first argument:
  python3 backend/ai/chroma_sync.py cards.json

Input shape (array of ApplicantCards):
  [
    {
      "applicationId": "...",
      "summary":       "...",
      "userId":        "...",
      "loanType":      "...",
      "riskLevel":     "...",
      "decision":      "...",
      "userCategory":  "...",
      "borrowerType":  "...",
      "occupation":    "...",
      ...other card fields...
    },
    ...
  ]

Output (stdout, JSON):
  { "upserted": <n>, "ids": ["...", ...], "errors": [...] }

Exit codes:
  0 — success (all records upserted)
  1 — fatal error (bad JSON, empty input)
  2 — partial success (some records skipped)

SAFE INTEGRATION GUARANTEE
  - Does NOT touch Node files, MongoDB, or existing services.
  - Only writes to the local Chroma persist directory.
"""

import sys
import json
import os

# Ensure sibling directory is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chroma_store import upsert_documents, collection_count

# ── Metadata fields to extract from each ApplicantCard ───────────────────────
# Keep this list compact — only values useful for metadata filtering later.
METADATA_FIELDS = [
    "applicationId",
    "userId",
    "loanType",
    "riskLevel",
    "decision",
    "userCategory",
    "borrowerType",
    "occupation",
    "incomeType",
    "status",
    "preScreenStatus",
    "creditScore",
    "probabilityOfDefault",
]


def _extract_metadata(card: dict) -> dict:
    meta = {}
    for field in METADATA_FIELDS:
        val = card.get(field)
        if val is None:
            meta[field] = ""
        elif isinstance(val, (bool,)):
            meta[field] = str(val).lower()
        elif isinstance(val, float):
            meta[field] = round(val, 4)
        else:
            meta[field] = val
    return meta


def sync_cards(cards: list[dict]) -> dict:
    """
    Validate and upsert a list of ApplicantCard dicts.

    Returns
    -------
    dict  { "upserted": int, "ids": list, "errors": list }
    """
    ids       = []
    documents = []
    metadatas = []
    errors    = []

    for i, card in enumerate(cards):
        app_id  = card.get("applicationId")
        summary = card.get("summary", "").strip()

        if not app_id:
            errors.append({"index": i, "reason": "missing applicationId"})
            continue
        if not summary:
            errors.append({"index": i, "applicationId": app_id,
                           "reason": "empty summary — card may not have been scored yet"})
            continue

        ids.append(str(app_id))
        documents.append(summary)
        metadatas.append(_extract_metadata(card))

    if not ids:
        return {"upserted": 0, "ids": [], "errors": errors}

    result = upsert_documents(ids=ids, documents=documents, metadatas=metadatas)
    result["errors"] = errors
    result["total_in_collection"] = collection_count()
    return result


# ── CLI entry point ───────────────────────────────────────────────────────────

def main():
    # Read input: file path arg or stdin
    if len(sys.argv) > 1:
        path = sys.argv[1]
        if not os.path.isfile(path):
            print(json.dumps({"error": f"File not found: {path}"}), file=sys.stderr)
            sys.exit(1)
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
    else:
        raw = sys.stdin.read()

    raw = raw.strip()
    if not raw:
        print(json.dumps({"error": "No input received"}), file=sys.stderr)
        sys.exit(1)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"JSON parse error: {e}"}), file=sys.stderr)
        sys.exit(1)

    # Accept both a single card dict and an array
    if isinstance(data, dict):
        data = [data]

    if not isinstance(data, list) or len(data) == 0:
        print(json.dumps({"error": "Input must be a non-empty JSON array of ApplicantCards"}),
              file=sys.stderr)
        sys.exit(1)

    result = sync_cards(data)

    print(json.dumps(result, ensure_ascii=False, indent=2))

    exit_code = 0
    if result.get("errors"):
        exit_code = 2 if result.get("upserted", 0) > 0 else 1
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
