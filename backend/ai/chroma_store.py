"""
chroma_store.py  —  Phase 6 low-level Chroma helpers
=====================================================
Initialises a *persistent* local Chroma client and exposes
clean, reusable helpers used by chroma_sync.py and chroma_query.py.

SAFE INTEGRATION GUARANTEE
  - Pure Python library — no Node files modified.
  - Persistence directory defaults to  backend/ai/chroma_data/
    (created automatically on first use).
  - Collection name: applicant_cards
"""

import os
from typing import Optional, List, Dict
import chromadb
from chromadb.config import Settings

# ── Config ────────────────────────────────────────────────────────────────────

# Persist in backend/ai/chroma_data/ (sibling of this file)
_THIS_DIR    = os.path.dirname(os.path.abspath(__file__))
PERSIST_DIR  = os.environ.get("CHROMA_PERSIST_DIR",
                               os.path.join(_THIS_DIR, "chroma_data"))
COLLECTION_NAME = "applicant_cards"

# ── Client singleton ──────────────────────────────────────────────────────────

_client     = None
_collection = None


def _get_client() -> chromadb.PersistentClient:
    """Return the shared persistent Chroma client (lazy init)."""
    global _client
    if _client is None:
        os.makedirs(PERSIST_DIR, exist_ok=True)
        _client = chromadb.PersistentClient(path=PERSIST_DIR)
    return _client


# ── Public helpers ────────────────────────────────────────────────────────────

def get_collection() -> chromadb.Collection:
    """
    Return (or create) the persistent `applicant_cards` collection.
    Uses cosine distance — better than L2 for text embeddings.
    """
    global _collection
    if _collection is None:
        client = _get_client()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def upsert_documents(
    ids:       List[str],
    documents: List[str],
    metadatas: List[Dict],
) -> Dict:
    """
    Upsert one or more documents into the collection.

    Parameters
    ----------
    ids        : list of unique applicantId strings
    documents  : list of applicant summary strings (used for embedding)
    metadatas  : list of metadata dicts (riskLevel, decision, etc.)

    Returns
    -------
    dict  { "upserted": <count>, "ids": [...] }
    """
    if not ids:
        return {"upserted": 0, "ids": []}

    # Chroma requires metadata values to be str/int/float/bool — sanitise.
    clean_meta = []
    for m in metadatas:
        clean_meta.append({
            k: (str(v) if v is not None else "") for k, v in m.items()
        })

    col = get_collection()
    col.upsert(ids=ids, documents=documents, metadatas=clean_meta)
    return {"upserted": len(ids), "ids": ids}


def query_documents(
    query_text:   str,
    n_results:    int = 5,
    where:        Optional[Dict] = None,
    include_fields: Optional[List[str]] = None,
) -> List[Dict]:
    """
    Query the collection for the top-k most semantically similar documents.

    Parameters
    ----------
    query_text     : natural language query string
    n_results      : number of results to return (default 5)
    where          : optional Chroma metadata filter dict
    include_fields : list of fields to include in results
                     default: ["metadatas", "distances", "documents"]

    Returns
    -------
    list of dicts:
      {
        "applicationId": str,
        "score":         float,   # cosine similarity 0-1 (higher = more similar)
        "distance":      float,   # raw cosine distance (lower = more similar)
        "document":      str,
        "metadata":      dict,
      }
    """
    col = get_collection()
    include = include_fields or ["metadatas", "distances", "documents"]

    kwargs = dict(
        query_texts=[query_text],
        n_results=min(n_results, col.count()) if col.count() > 0 else 1,
        include=include,
    )
    if where:
        kwargs["where"] = where

    results = col.query(**kwargs)

    output = []
    ids        = results.get("ids",        [[]])[0]
    distances  = results.get("distances",  [[]])[0]
    docs       = results.get("documents",  [[]])[0]
    metas      = results.get("metadatas",  [[]])[0]

    for i, app_id in enumerate(ids):
        dist  = distances[i] if i < len(distances) else None
        score = round(1.0 - dist, 4) if dist is not None else None
        output.append({
            "applicationId": app_id,
            "score":         score,
            "distance":      round(dist, 4) if dist is not None else None,
            "document":      docs[i]  if i < len(docs)  else "",
            "metadata":      metas[i] if i < len(metas) else {},
        })

    return output


def delete_documents(ids: List[str]) -> Dict:
    """
    Delete documents by id.  Used by test cleanup.

    Returns
    -------
    dict  { "deleted": <count>, "ids": [...] }
    """
    if not ids:
        return {"deleted": 0, "ids": []}
    col = get_collection()
    col.delete(ids=ids)
    return {"deleted": len(ids), "ids": ids}


def collection_count() -> int:
    """Return total number of documents currently in the collection."""
    return get_collection().count()
