// Talks to the HireFlow FastAPI backend (api/main.py).
// Set VITE_USE_MOCK=true (or run `npm run mock`) to use sample data instead.
import { mockApi } from "./mockData";

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
export const USING_MOCK = import.meta.env.VITE_USE_MOCK === "true";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, options);
  } catch {
    throw new Error(`Can't reach the backend at ${BASE_URL}. Start it with "python start_backend.py".`);
  }
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json()).detail;
    } catch {
      /* body was not JSON */
    }
    throw new Error(detail || `Request to ${path} failed with status ${response.status}.`);
  }
  return response.json();
}

const json = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const realApi = {
  getStatus: () => request("/status"),
  reindex: () => request("/index", { method: "POST" }),
  // { job_title, job_description, required_skills[], location, min_experience, top_k }
  search: (params) => request("/search", json(params)),
  // { job_title, job_description, required_skills[], candidates[] }
  evaluate: (params) => request("/evaluate", json(params)),
  upload: (files) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return request("/upload", { method: "POST", body: form });
  },
  getMemory: () => request("/memory"),
  // { query, expected_skills[], top_k }
  runRagEval: (params) => request("/rag-eval", json(params)),
};

export const api = USING_MOCK ? mockApi : realApi;
