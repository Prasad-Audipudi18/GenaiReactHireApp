"""
Hybrid search system combining BM25 (lexical) and vector (semantic) search.
Provides comprehensive candidate and job matching capabilities.
"""

from typing import List, Dict, Any
from langchain.schema import Document
from rank_bm25 import BM25Okapi
from core.vector_store import VectorStore
from utils.utils import get_logger

logger = get_logger(__name__)

class HybridIndexer:
    """Combines BM25 keyword search with vector semantic search for better results"""

    def __init__(self):
        """Initialize both BM25 and vector search components"""
        self.vector_store = VectorStore()
        self.vector_store.initialize()  # Set up Pinecone vector store
        self.bm25_resumes = None        # BM25 index for resumes
        self.resume_texts = []          # Text content for BM25 resume search
        self.resume_metadata = []       # Metadata parallel to resume_texts (same index)

    def index_resumes(self, resumes: List[Document]) -> bool:
        """Index resumes for both keyword and semantic search"""
        if not resumes:
            return False
        try:
            # Prepare texts and metadata for BM25
            self.resume_texts = []
            self.resume_metadata = []
            for resume in resumes:
                text = resume.page_content.lower()
                if text.strip():
                    self.resume_texts.append(text)
                    self.resume_metadata.append(resume.metadata)

            if self.resume_texts:
                tokenized_texts = [text.split() for text in self.resume_texts]
                self.bm25_resumes = BM25Okapi(tokenized_texts)

            # Add to vector store if available
            if self.vector_store.is_ready():
                self.vector_store.add_resumes(resumes)

            return True

        except Exception as e:
            logger.error(f"Resume indexing failed: {e}")
            return False
    
    def search_resumes(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search resumes using both BM25 and vector search, then combine results"""
        if not self.bm25_resumes:
            return []
        try:
            # BM25 search — convert numpy array to plain Python list immediately
            query_tokens = query.lower().split()
            bm25_scores = [float(s) for s in self.bm25_resumes.get_scores(query_tokens)]
            
            # Vector search (if available) — no filter needed, only resumes are indexed
            vector_results = []

            if self.vector_store.is_ready():
                vector_results = self.vector_store.search_resumes(query, top_k * 2)
                logger.info(f"Vector search returned {len(vector_results)} results for query: {query[:50]}...")
            
            # Combine results
            return self.combine_results(bm25_scores, vector_results, top_k)
                
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    def combine_results(self, bm25_scores: List[float], vector_results: List[Dict],
                        top_k: int) -> List[Dict[str, Any]]:
        """Merge BM25 keyword and vector semantic results using Reciprocal Rank Fusion (RRF).

        BM25 scores are normalized to [0, 1] before ranking.
        Vector (cosine) scores are already in [0, 1].
        RRF combines ranked lists: rrf_score = 1 / (k + rank), k=60 is a standard constant
        that dampens the impact of high ranks and avoids division-by-zero.
        Candidates appearing in both lists get their RRF scores summed.
        """
        RRF_K = 60

        # --- Normalize BM25 scores to [0, 1] ---
        max_bm25 = max(bm25_scores) if bm25_scores else 1.0
        if max_bm25 == 0:
            max_bm25 = 1.0

        # Build BM25 result list sorted by score (descending) for rank assignment
        bm25_ranked = sorted(
            [
                {
                    'candidate_id': self.resume_metadata[i].get('candidate_id', f"c_{i}"),
                    'text': self.resume_texts[i],
                    'name': self.resume_metadata[i].get('name', f"Candidate {i+1}"),
                    'skills': self.resume_metadata[i].get('skills', []),
                    'location': self.resume_metadata[i].get('location', 'Unknown'),
                    'experience': self.resume_metadata[i].get('experience'),
                    'bm25_score': bm25_scores[i] / max_bm25,
                    'vector_score': 0.0,
                }
                for i in range(len(bm25_scores))
                if i < len(self.resume_texts)
            ],
            key=lambda x: x['bm25_score'],
            reverse=True,
        )
        # Build vector result list sorted by score (descending) for rank assignment
        vector_ranked = sorted(
            [
                {
                    'candidate_id': vec.get('metadata', {}).get('candidate_id', f"c_vec_{idx}"),
                    'text': vec.get('page_content', ''),
                    'name': vec.get('metadata', {}).get('name', 'Unknown Candidate'),
                    'skills': vec.get('metadata', {}).get('skills', []),
                    'location': vec.get('metadata', {}).get('location', 'Unknown'),
                    'experience': vec.get('metadata', {}).get('experience', 5),
                    'bm25_score': 0.0,
                    'vector_score': float(vec.get('score', 0.0)),
                }
                for idx, vec in enumerate(vector_results)
            ],
            key=lambda x: x['vector_score'],
            reverse=True,
        )
        # --- Apply RRF: accumulate scores keyed by candidate_id ---
        merged: Dict[str, Dict] = {}

        for rank, candidate in enumerate(bm25_ranked):
            cid = candidate['candidate_id']
            rrf = 1.0 / (RRF_K + rank + 1)
            if cid not in merged:
                merged[cid] = {**candidate, 'combined_score': 0.0}
            merged[cid]['combined_score'] += rrf
            merged[cid]['bm25_score'] = candidate['bm25_score']

        for rank, candidate in enumerate(vector_ranked):
            cid = candidate['candidate_id']
            rrf = 1.0 / (RRF_K + rank + 1)
            if cid not in merged:
                merged[cid] = {**candidate, 'combined_score': 0.0}
            merged[cid]['combined_score'] += rrf
            # Prefer richer metadata from vector store
            merged[cid]['vector_score'] = candidate['vector_score']
            if candidate['skills']:
                merged[cid]['skills'] = candidate['skills']
            if candidate['location'] != 'Unknown':
                merged[cid]['location'] = candidate['location']
            if candidate['text']:
                merged[cid]['text'] = candidate['text']
            if candidate['name'] != 'Unknown Candidate':
                merged[cid]['name'] = candidate['name']

        # Sort by combined RRF score and return top_k
        all_results = sorted(merged.values(), key=lambda x: x['combined_score'], reverse=True)
        return all_results[:top_k]
    
    def get_index_stats(self) -> Dict[str, Any]:
        """Get status of BM25 and vector search components"""
        return {
            'resumes_ready': bool(self.bm25_resumes),
            'vector_store_ready': self.vector_store.is_ready(),
            'hybrid_ready': bool(self.bm25_resumes) and self.vector_store.is_ready()
        }
