// Sample data shaped exactly like the FastAPI responses, so the UI can run without a backend.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CANDIDATES = [
  { candidate_id: "c_Angela_Lewis_Resume_09", name: "Angela Lewis", location: "Chicago, IL", experience: 9,
    skills: ["QuickBooks", "GAAP", "Tax Preparation", "Excel", "Month-end Close", "Audit"],
    bm25_score: 0.9412, vector_score: 0.8123,
    text: "Senior accountant with 9 years in mid-market manufacturing. Led month-end close for a $120M business unit, cut close time from 9 to 5 days, and prepared federal and state tax filings. Daily QuickBooks and advanced Excel user." },
  { candidate_id: "c_Brian_Martin_Resume_38", name: "Brian Martin", location: "New York, NY", experience: 7,
    skills: ["NetSuite", "GAAP", "Financial Reporting", "Excel", "Reconciliation"],
    bm25_score: 0.721, vector_score: 0.8391,
    text: "CPA with 7 years across public accounting and in-house finance. Owns consolidated financial statements and bank reconciliations for four entities in NetSuite. Supported two external audits with zero findings." },
  { candidate_id: "c_Cynthia_Garcia_Resume_37", name: "Cynthia Garcia", location: "Austin, TX", experience: 6,
    skills: ["QuickBooks", "Payroll", "Accounts Payable", "Excel", "Tax Preparation"],
    bm25_score: 0.8655, vector_score: 0.7012,
    text: "Staff-to-senior accountant at a regional healthcare group. Runs AP and payroll for 300 employees, prepares quarterly sales tax returns, and maintains the QuickBooks chart of accounts." },
  { candidate_id: "c_Emily_Green_Resume_46", name: "Emily Green", location: "Remote", experience: 4,
    skills: ["Xero", "Budgeting", "Forecasting", "Excel", "SQL"],
    bm25_score: 0.512, vector_score: 0.773,
    text: "FP&A-leaning accountant with 4 years at SaaS startups. Builds rolling forecasts and budget-vs-actuals in Excel and SQL. Comfortable with Xero; limited exposure to tax work." },
  { candidate_id: "c_Kevin_Torres_Resume_36", name: "Kevin Torres", location: "Denver, CO", experience: 11,
    skills: ["SAP", "GAAP", "Audit", "Internal Controls", "SOX"],
    bm25_score: 0.634, vector_score: 0.6955,
    text: "Accounting manager with 11 years in enterprise environments. Designed SOX controls, managed a team of five, and led an SAP migration. Has not used QuickBooks." },
  { candidate_id: "c_Lisa_Turner_Resume_23", name: "Lisa Turner", location: "Chicago, IL", experience: 3,
    skills: ["QuickBooks", "Accounts Receivable", "Excel"],
    bm25_score: 0.5803, vector_score: 0.551,
    text: "Junior accountant handling AR and collections for a logistics company. QuickBooks power user working toward CPA eligibility." },
];

const EVALS = {
  c_Angela_Lewis_Resume_09: { fit_score: 92, strengths: ["Nine years of senior-level close and reporting", "Hands-on QuickBooks and tax filing experience", "Measurable process improvement (close cut to 5 days)"], gaps: ["No people-management experience mentioned"], risks: [], summary: "Strong match: covers every required skill with evidence of ownership." },
  c_Brian_Martin_Resume_38: { fit_score: 84, strengths: ["Licensed CPA", "Multi-entity consolidation", "Clean audit track record"], gaps: ["Uses NetSuite, not QuickBooks", "Little direct tax preparation"], risks: [], summary: "Excellent reporting depth; would need a short ramp on QuickBooks." },
  c_Cynthia_Garcia_Resume_37: { fit_score: 79, strengths: ["Daily QuickBooks user", "Prepares tax returns", "Broad AP and payroll coverage"], gaps: ["Six years, slightly under the senior bar", "Limited GAAP reporting exposure"], risks: [], summary: "Solid operational accountant ready to step into a senior role." },
  c_Emily_Green_Resume_46: { fit_score: 61, strengths: ["Strong forecasting and Excel modeling", "Adds SQL skills"], gaps: ["Limited tax work", "Four years of experience"], risks: ["Profile leans toward FP&A rather than accounting"], summary: "Promising analyst; weaker fit for a tax-heavy senior role." },
  c_Kevin_Torres_Resume_36: { fit_score: 58, strengths: ["Deep controls and audit background", "Team leadership"], gaps: ["No QuickBooks", "No tax preparation listed"], risks: ["May be over-leveled for the role"], summary: "Experienced, but the toolset points to enterprise roles." },
  c_Lisa_Turner_Resume_23: { fit_score: 45, strengths: ["QuickBooks proficiency"], gaps: ["Three years of experience", "No tax or close ownership"], risks: [], summary: "Too junior for this opening; worth keeping for staff roles." },
};

const history = ["Senior Accountant QuickBooks Tax Preparation", "Payroll specialist Austin", "Financial analyst SQL forecasting"];
let indexed = 50;

export const mockApi = {
  async getStatus() {
    await wait(250);
    return { resumes_ready: true, vector_store_ready: true, hybrid_ready: true, pinecone_vector_count: indexed };
  },
  async reindex() {
    await wait(1600);
    return { indexed, message: `Successfully indexed ${indexed} resumes` };
  },
  async search({ job_title, required_skills = [], location, min_experience, top_k = 5 }) {
    await wait(900);
    history.push(`${job_title} ${required_skills.join(" ")}`.trim());
    const loc = (location || "").toLowerCase();
    const rrf = (rank) => 1 / (60 + rank + 1);
    let results = CANDIDATES.map((c) => ({ ...c }))
      .filter((c) => !loc || c.location.toLowerCase().includes(loc))
      .filter((c) => !min_experience || (c.experience ?? 0) >= min_experience);
    const byBm25 = [...results].sort((a, b) => b.bm25_score - a.bm25_score).map((c) => c.candidate_id);
    const byVec = [...results].sort((a, b) => b.vector_score - a.vector_score).map((c) => c.candidate_id);
    results.forEach((c) => {
      c.combined_score = +(rrf(byBm25.indexOf(c.candidate_id)) + rrf(byVec.indexOf(c.candidate_id))).toFixed(4);
    });
    results = results.sort((a, b) => b.combined_score - a.combined_score).slice(0, top_k);
    return { results, total: results.length };
  },
  async evaluate({ candidates }) {
    await wait(1800);
    return {
      evaluations: candidates.map((c) => ({ candidate_id: c.candidate_id, ...EVALS[c.candidate_id] })),
      llm_available: true,
    };
  },
  async upload(files) {
    await wait(1400);
    indexed += files.length;
    return {
      results: files.map((f) => ({ filename: f.name, ok: true, message: "Parsed and indexed" })),
      indexed: files.length,
    };
  },
  async getMemory() {
    await wait(300);
    return {
      stats: { total_messages: history.length * 2 + 12, search_count: history.length, candidate_views: 6 },
      recent_searches: history.slice(-5).reverse(),
    };
  },
  async runRagEval() {
    await wait(2200);
    return { answer_relevancy: 0.86, context_precision: 0.78, faithfulness: 0.91, answer_correctness: 0.74, overall_score: 8.2 };
  },
};
