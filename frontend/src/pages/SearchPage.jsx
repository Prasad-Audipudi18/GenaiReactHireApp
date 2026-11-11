import { useMemo, useState } from "react";
import { api } from "../api/client";
import SkillInput from "../components/SkillInput";
import CandidateCard from "../components/CandidateCard";

const EVAL_LIMIT = 5;

export default function SearchPage({ ready, onGoUpload }) {
  const [form, setForm] = useState({
    job_title: "Senior Accountant",
    job_description: "Own month-end close and tax filings for a growing manufacturing business.",
    required_skills: ["QuickBooks", "Tax Preparation", "Excel"],
    location: "",
    min_experience: 0,
    top_k: 5,
  });
  const [results, setResults] = useState(null);
  const [searchedFor, setSearchedFor] = useState(null);
  const [evaluations, setEvaluations] = useState({});
  const [searching, setSearching] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("hybrid");

  const set = (key) => (e) => setForm({ ...form, [key]: e?.target ? e.target.value : e });

  const runSearch = async (e) => {
    e.preventDefault();
    if (!form.job_title.trim()) {
      setError("Add a job title to search.");
      return;
    }
    setError("");
    setSearching(true);
    setEvaluations({});
    setSortBy("hybrid");
    try {
      const params = { ...form, min_experience: Number(form.min_experience) || 0, top_k: Number(form.top_k) };
      const data = await api.search(params);
      setResults(data.results);
      setSearchedFor(params);
      setSearching(false);
      if (data.results.length) evaluateTop(params, data.results);
    } catch (err) {
      setError(err.message);
      setSearching(false);
    }
  };

  const evaluateTop = async (params, list) => {
    setEvaluating(true);
    try {
      const data = await api.evaluate({
        job_title: params.job_title,
        job_description: params.job_description,
        required_skills: params.required_skills,
        candidates: list.slice(0, EVAL_LIMIT),
      });
      setEvaluations(Object.fromEntries(data.evaluations.map((ev) => [ev.candidate_id, ev])));
    } catch (err) {
      setError(`Search worked, but the AI review failed: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const sorted = useMemo(() => {
    if (!results) return [];
    if (sortBy === "hybrid") return results;
    return [...results].sort(
      (a, b) => (evaluations[b.candidate_id]?.fit_score ?? -1) - (evaluations[a.candidate_id]?.fit_score ?? -1)
    );
  }, [results, evaluations, sortBy]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Find candidates</h1>
        <p className="lede">Describe the role. HireFlow matches resumes by keywords and by meaning, then Gemini reviews the best fits.</p>
      </header>

      {ready === false && (
        <div className="banner">
          No resumes are indexed yet.{" "}
          <button className="link" onClick={onGoUpload}>Add resumes</button> or re-index from the sidebar.
        </div>
      )}

      <form className="composer" onSubmit={runSearch}>
        <div className="field field-title">
          <label htmlFor="job_title">Job title</label>
          <input id="job_title" value={form.job_title} onChange={set("job_title")} placeholder="e.g. Senior Accountant" />
        </div>
        <div className="field field-desc">
          <label htmlFor="job_description">What the role involves</label>
          <textarea id="job_description" rows={3} value={form.job_description} onChange={set("job_description")}
            placeholder="Responsibilities, tools, industry…" />
        </div>
        <div className="field field-skills">
          <label htmlFor="skills">Required skills</label>
          <SkillInput id="skills" skills={form.required_skills} onChange={set("required_skills")}
            placeholder="Type a skill and press Enter" />
        </div>
        <div className="composer-row">
          <div className="field">
            <label htmlFor="location">Location</label>
            <input id="location" value={form.location} onChange={set("location")} placeholder="Any" />
          </div>
          <div className="field">
            <label htmlFor="min_exp">Minimum years</label>
            <input id="min_exp" type="number" min="0" max="40" value={form.min_experience} onChange={set("min_experience")} />
          </div>
          <div className="field">
            <label htmlFor="top_k">Results</label>
            <select id="top_k" value={form.top_k} onChange={set("top_k")}>
              {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={searching}>
            {searching ? "Searching…" : "Find candidates"}
          </button>
        </div>
      </form>

      {error && <p className="error" role="alert">{error}</p>}

      {results && (
        <section className="results" aria-live="polite">
          <div className="results-head">
            <h2>
              {results.length ? `${results.length} matches for ${searchedFor.job_title}` : `No matches for ${searchedFor.job_title}`}
            </h2>
            {results.length > 0 && (
              <div className="sort" role="group" aria-label="Sort results">
                <button className={sortBy === "hybrid" ? "is-on" : ""} onClick={() => setSortBy("hybrid")}>Search rank</button>
                <button className={sortBy === "fit" ? "is-on" : ""} onClick={() => setSortBy("fit")}
                  disabled={!Object.keys(evaluations).length}>AI fit</button>
              </div>
            )}
          </div>

          {results.length === 0 ? (
            <p className="empty">Try removing the location or lowering the minimum years.</p>
          ) : (
            <>
              <div className="legend">
                <span><i className="sw sw-keyword" /> Keywords: exact terms found (BM25)</span>
                <span><i className="sw sw-meaning" /> Meaning: semantic similarity (Pinecone)</span>
                <span><i className="sw sw-fit" /> Ring: Gemini fit score</span>
              </div>
              {sorted.map((c, i) => (
                <CandidateCard key={c.candidate_id} rank={i + 1} candidate={c}
                  evaluation={evaluations[c.candidate_id]}
                  evaluating={evaluating && results.indexOf(c) < EVAL_LIMIT}
                  requiredSkills={searchedFor.required_skills} />
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}
