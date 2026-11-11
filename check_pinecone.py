"""
HireFlow Pinecone diagnostic.
Put this file in the Hireflow folder (next to start_backend.py) and run:
    python check_pinecone.py
It runs each indexing step on its own and prints the real error, because
HybridIndexer.index_resumes() hides Pinecone failures.
"""
import sys
import time
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))


def step(n, title):
    print(f"\n[{n}] {title}")


try:
    step(1, "Reading .env")
    from utils.config import PINECONE_API_KEY, PINECONE_INDEX_NAME, PINECONE_DIMENSION, GOOGLE_API_KEY
    print("    PINECONE_API_KEY set:", bool(PINECONE_API_KEY))
    print("    GOOGLE_API_KEY set:  ", bool(GOOGLE_API_KEY))
    print("    index name:", PINECONE_INDEX_NAME, "| dimension:", PINECONE_DIMENSION)

    step(2, "Connecting to Pinecone")
    from core.vector_store import VectorStore
    vs = VectorStore()
    print("    ready:", vs.initialize())
    print("    stats before:", vs.index.describe_index_stats())

    step(3, "Finding resume PDFs")
    resumes_dir = ROOT / "data" / "resumes"
    pdfs = sorted(resumes_dir.glob("*.pdf"))
    print(f"    {len(pdfs)} PDFs in {resumes_dir}")
    if not pdfs:
        sys.exit("    STOP: no PDFs found. Put resumes in data/resumes/.")

    step(4, "Extracting text from the first PDF")
    from utils.utils import load_pdf
    text = load_pdf(str(pdfs[0]))
    print(f"    {pdfs[0].name}: {len(text or '')} characters")
    if not text:
        sys.exit("    STOP: no text extracted from the PDF.")

    step(5, "Parsing with Gemini")
    from core.ingestion import _try_parse_resume
    parsed = _try_parse_resume(text, f"c_{pdfs[0].stem}")
    print("    skills:", parsed.get("skills"))
    print("    location:", parsed.get("location"), "| experience:", parsed.get("experience"))

    step(6, "Creating the embedding")
    vec = vs.embeddings.embed_documents([text])[0]
    print("    embedding length:", len(vec))

    step(7, "Upserting one record directly (errors are NOT hidden here)")
    metadata = {
        "candidate_id": f"c_{pdfs[0].stem}",
        "name": parsed.get("name") or pdfs[0].stem.replace("_", " ").title(),
        "filename": pdfs[0].name,
        "skills": [str(s) for s in parsed.get("skills", [])],
        "location": parsed.get("location") or "Unknown",
        "experience": parsed.get("experience"),
    }
    metadata = {k: v for k, v in metadata.items() if v is not None}
    print("    metadata:", metadata)
    print("    upsert response:", vs.index.upsert(vectors=[{"id": metadata["candidate_id"], "values": vec, "metadata": metadata}]))

    step(8, "Waiting 10 s for Pinecone to update its count")
    time.sleep(10)
    print("    stats after:", vs.index.describe_index_stats())
    print("\nDONE. If the count went up, Pinecone works; paste this output so we can fix the indexing path.")

except SystemExit as e:
    print(e)
except Exception:
    print("\nFAILED at the step above. Full error:")
    traceback.print_exc()