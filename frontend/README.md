# HireFlow — React frontend

React (Vite) UI for the HireFlow RAG backend. It replaces `streamlit/app.py` with three screens:

- **Find candidates** – job title, description, skill chips, location, min years, result count.
  Results appear right away with Keyword (BM25) and Meaning (vector) bars; Gemini fit scores
  fill in a moment later via `/evaluate`, and you can re-sort by AI fit.
- **Add resumes** – drag-and-drop PDFs, parsed by Gemini and indexed via `/upload`.
- **Search quality** – memory stats, recent searches, and RAGAS scores via `/rag-eval`.

## Folder layout (put it next to the Python code)

```
Hireflow/
├── api/main.py          <- replace with the updated main.py (adds CORS + new endpoints)
├── core/ ... utils/ ...
└── frontend/            <- this folder
```

## 1. Backend

```bash
pip install python-multipart      # needed by FastAPI for the /upload endpoint
python start_backend.py           # http://localhost:8000
```

New/changed endpoints in `api/main.py`:

| Method | Path        | Used by                              |
|--------|-------------|--------------------------------------|
| GET    | /status     | sidebar index status                 |
| POST   | /index      | "Re-index resumes" button            |
| POST   | /search     | search form (now with filters)       |
| POST   | /evaluate   | AI fit review for the top 5          |
| POST   | /upload     | Add resumes page                     |
| GET    | /memory     | Search quality page                  |
| POST   | /rag-eval   | Search quality page                  |

`/search` still accepts the old `{"query": "...", "top_k": 5}` body.

## 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm run dev              # http://localhost:5173
```

No backend handy? `npm run mock` runs the UI on sample data.

## Structure

```
src/
├── api/client.js        all fetch calls in one place (swap to mock with VITE_USE_MOCK)
├── api/mockData.js      sample responses shaped like the FastAPI models
├── components/          Sidebar, SkillInput, MatchBars, FitScore, CandidateCard
├── pages/               SearchPage, UploadPage, InsightsPage
└── styles.css           design tokens (light + dark) and layout
```
