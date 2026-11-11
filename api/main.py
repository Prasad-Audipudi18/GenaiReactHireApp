"""
HireFlow FastAPI backend (React-ready).

Endpoints:
    GET  /status    — index stats
    POST /index     — (re-)index every PDF in data/resumes/
    POST /search    — hybrid search + post-search filters (skills / location / experience)
    POST /evaluate  — Gemini (or rule-based) fit review for a list of candidates
    POST /upload    — upload PDF resumes, parse with Gemini, index them
    GET  /memory    — search memory stats + recent searches
    POST /rag-eval  — RAGAS quality metrics for a query

Run with:
    python start_backend.py
or:
    uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

_project_root = Path(__file__).resolve().parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from core.filters import apply_filters
from core.hybrid_indexer import HybridIndexer
from core.ingestion import DocumentProcessor, load_resumes
from core.memory_rag import MemoryRAG
from core.re_ranker import ReRanker
from utils.schemas import SearchQuery

app = FastAPI(title="HireFlow API", version="1.1.0")

# Let the React dev server (Vite, port 5173) call this API from the browser.
_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_DATA_RESUMES_DIR = _project_root / "data" / "resumes"

# ---------------------------------------------------------------------------
# Lazily created singletons shared across requests
# ---------------------------------------------------------------------------
_indexer: Optional[HybridIndexer] = None
_reranker: Optional[ReRanker] = None
_memory: Optional[MemoryRAG] = None


def get_indexer() -> HybridIndexer:
    global _indexer
    if _indexer is None:
        _indexer = HybridIndexer()
    return _indexer


def get_reranker() -> ReRanker:
    global _reranker
    if _reranker is None:
        _reranker = ReRanker()
    return _reranker


def get_memory() -> MemoryRAG:
    global _memory
    if _memory is None:
        _memory = MemoryRAG()
    return _memory


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class SearchRequest(BaseModel):
    job_title: str = ""
    job_description: str = ""
    required_skills: List[str] = []
    location: str = ""
    min_experience: int = 0
    top_k: int = 5
    query: Optional[str] = None  # still accepted, for the old curl examples


class CandidateResult(BaseModel):
    candidate_id: str
    name: str
    bm25_score: float
    vector_score: float
    combined_score: float
    skills: List[str]
    location: str
    experience: Optional[int]
    text: str = ""  # short excerpt for the resume preview


class SearchResponse(BaseModel):
    results: List[CandidateResult]
    total: int


class EvaluateCandidate(BaseModel):
    candidate_id: str
    name: str = "Unknown"
    text: str = ""
    skills: List[str] = []
    experience: Optional[int] = None


class EvaluateRequest(BaseModel):
    job_title: str = "Position"
    job_description: str = ""
    required_skills: List[str] = []
    candidates: List[EvaluateCandidate]


class EvaluationOut(BaseModel):
    candidate_id: str
    fit_score: int
    strengths: List[str]
    gaps: List[str]
    risks: List[str] = []
    summary: str


class EvaluateResponse(BaseModel):
    evaluations: List[EvaluationOut]
    llm_available: bool


class IndexResponse(BaseModel):
    indexed: int
    message: str


class StatusResponse(BaseModel):
    resumes_ready: bool
    vector_store_ready: bool
    hybrid_ready: bool
    pinecone_vector_count: int


class UploadResult(BaseModel):
    filename: str
    ok: bool
    message: str


class UploadResponse(BaseModel):
    results: List[UploadResult]
    indexed: int


class RagEvalRequest(BaseModel):
    query: str
    expected_skills: List[str] = []
    top_k: int = 5


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/status", response_model=StatusResponse)
def status():
    indexer = get_indexer()
    stats = indexer.get_index_stats()
    pinecone_count = 0
    if indexer.vector_store.is_ready():
        pinecone_count = indexer.vector_store.get_stats().get("total_vector_count", 0)
    return StatusResponse(
        resumes_ready=stats["resumes_ready"],
        vector_store_ready=stats["vector_store_ready"],
        hybrid_ready=stats["hybrid_ready"],
        pinecone_vector_count=pinecone_count,
    )


@app.post("/index", response_model=IndexResponse)
def index_resumes():
    indexer = get_indexer()
    resumes = load_resumes(str(_DATA_RESUMES_DIR))
    if not resumes:
        raise HTTPException(status_code=404, detail="No resume PDFs found in data/resumes/.")
    if not indexer.index_resumes(resumes):
        raise HTTPException(status_code=500, detail="Indexing failed. Check the server logs.")
    return IndexResponse(indexed=len(resumes), message=f"Successfully indexed {len(resumes)} resumes")


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    indexer = get_indexer()
    if not indexer.bm25_resumes:
        raise HTTPException(status_code=503, detail="The index isn't built yet. Re-index resumes first.")

    query = req.query or f"{req.job_title} {' '.join(req.required_skills)} {req.job_description}".strip()
    if not query:
        raise HTTPException(status_code=422, detail="Add a job title or description to search.")

    raw = indexer.search_resumes(query, top_k=req.top_k)
    raw = apply_filters(
        raw,
        required_skills=req.required_skills or None,
        target_locations=[req.location] if req.location.strip() else None,
        min_experience=req.min_experience if req.min_experience > 0 else None,
    )

    memory = get_memory()
    memory.record_search(query, len(raw))
    for c in raw[:3]:
        memory.record_candidate_view(c.get("name", "Unknown"))

    results = [
        CandidateResult(
            candidate_id=r.get("candidate_id", ""),
            name=r.get("name", "Unknown"),
            bm25_score=round(r.get("bm25_score", 0.0), 4),
            vector_score=round(r.get("vector_score", 0.0), 4),
            combined_score=round(r.get("combined_score", 0.0), 4),
            skills=r.get("skills", []) or [],
            location=r.get("location", "Unknown") or "Unknown",
            experience=r.get("experience"),
            text=(r.get("text", "") or "")[:600],
        )
        for r in raw
    ]
    return SearchResponse(results=results, total=len(results))


@app.post("/evaluate", response_model=EvaluateResponse)
def evaluate(req: EvaluateRequest):
    """Fit review for the given candidates. The UI calls this right after /search
    so results appear immediately and AI scores fill in when ready."""
    reranker = get_reranker()
    jd = SearchQuery(title=req.job_title or "Position", text=req.job_description,
                     required_skills=req.required_skills)
    evaluations = reranker.re_rank_candidates([c.model_dump() for c in req.candidates], jd)
    return EvaluateResponse(
        evaluations=[
            EvaluationOut(
                candidate_id=e.candidate_id, fit_score=e.fit_score, strengths=e.strengths,
                gaps=e.gaps, risks=e.risks, summary=e.summary,
            )
            for e in evaluations
        ],
        llm_available=reranker.is_available(),
    )


@app.post("/upload", response_model=UploadResponse)
async def upload(files: List[UploadFile] = File(...)):
    """Same flow as the Streamlit 'Add Resumes' panel."""
    from langchain.schema import Document
    from core.parsing import ResumeParser

    indexer = get_indexer()
    processor = DocumentProcessor()
    try:
        parser = ResumeParser()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    _DATA_RESUMES_DIR.mkdir(parents=True, exist_ok=True)
    results: List[UploadResult] = []
    indexed = 0

    for f in files:
        if not f.filename.lower().endswith(".pdf"):
            results.append(UploadResult(filename=f.filename, ok=False, message="Not a PDF"))
            continue
        try:
            dest = _DATA_RESUMES_DIR / Path(f.filename).name
            with open(dest, "wb") as out:
                shutil.copyfileobj(f.file, out)

            text = processor.load_pdf(str(dest))
            if not text:
                results.append(UploadResult(filename=f.filename, ok=False, message="No text could be extracted"))
                continue

            stem = dest.stem
            candidate_id = f"c_{stem}"
            parsed = parser.parse_resume(text, candidate_id)
            doc = Document(
                page_content=text,
                metadata={
                    "source": str(dest),
                    "filename": dest.name,
                    "candidate_id": candidate_id,
                    "name": stem.replace("_", " ").title(),
                    "location": parsed.get("location", "N/A"),
                    "experience": parsed.get("experience", 0),
                    "skills": parsed.get("skills", []),
                },
            )
            if indexer.index_resumes([doc]):
                indexed += 1
                results.append(UploadResult(filename=f.filename, ok=True, message="Parsed and indexed"))
            else:
                results.append(UploadResult(filename=f.filename, ok=False, message="Indexing failed"))
        except Exception as e:  # keep going with the other files
            results.append(UploadResult(filename=f.filename, ok=False, message=str(e)))

    return UploadResponse(results=results, indexed=indexed)


@app.get("/memory")
def memory():
    m = get_memory()
    return {"stats": m.get_memory_stats(), "recent_searches": list(reversed(m.get_search_history()))}


@app.post("/rag-eval")
def rag_eval(req: RagEvalRequest):
    import numpy as np
    from core.evaluator import RAGEvaluator

    indexer = get_indexer()
    if not indexer.bm25_resumes:
        raise HTTPException(status_code=503, detail="The index isn't built yet. Re-index resumes first.")
    evaluator = RAGEvaluator(indexer.vector_store, indexer)
    skills = [s.strip() for s in req.expected_skills if s.strip()]
    metrics = evaluator.evaluate_search_quality(req.query, skills, "deep", req.top_k)
    # RAGAS can return per-sample lists; average them so the UI always gets numbers.
    return {k: float(np.mean(v)) for k, v in metrics.to_dict().items()}
