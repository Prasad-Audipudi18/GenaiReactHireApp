import { useEffect, useState } from "react";
import { api } from "../api/client";
import SkillInput from "../components/SkillInput";

const METRICS = [
  ["answer_relevancy", "Answer relevancy", "Do the results address the query?"],
  ["context_precision", "Context precision", "Are the top results the relevant ones?"],
  ["faithfulness", "Faithfulness", "Is the answer grounded in the resumes?"],
  ["answer_correctness", "Answer correctness", "Do results match the expected skills?"],
];

export default function InsightsPage() {
  const [memory, setMemory] = useState(null);
  const [query, setQuery] = useState("Senior Accountant with QuickBooks");
  const [skills, setSkills] = useState(["QuickBooks", "Accounting", "Excel"]);
  const [topK, setTopK] = useState(5);
  const [metrics, setMetrics] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getMemory().then(setMemory).catch((e) => setError(e.message));
  }, []);

  const run = async (e) => {
    e.preventDefault();
    setRunning(true);
    setError("");
    try {
      setMetrics(await api.runRagEval({ query, expected_skills: skills, top_k: Number(topK) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const verdict = (s) =>
    s >= 8 ? "Excellent. Results are relevant and grounded." : s >= 6 ? "Good, with room to improve ranking." : "Weak. Check indexing and query expansion.";

  return (
    <div className="page">
      <header className="page-head">
        <h1>Search quality</h1>
        <p className="lede">Recent activity from conversation memory, and RAGAS scores for any query you want to test.</p>
      </header>

      <section className="activity">
        <div className="stat"><span className="stat-num">{memory?.stats.search_count ?? "–"}</span><span>searches</span></div>
        <div className="stat"><span className="stat-num">{memory?.stats.candidate_views ?? "–"}</span><span>candidates viewed</span></div>
        <div className="stat"><span className="stat-num">{memory?.stats.total_messages ?? "–"}</span><span>memory entries</span></div>
        <div className="recent">
          <h3>Recent searches</h3>
          {memory?.recent_searches?.length ? (
            <ol>{memory.recent_searches.map((q, i) => <li key={i}>{q}</li>)}</ol>
          ) : (
            <p className="muted">No searches yet. Run one from Find candidates.</p>
          )}
        </div>
      </section>

      <section className="eval">
        <h2>Test a query</h2>
        <form className="composer" onSubmit={run}>
          <div className="field field-title">
            <label htmlFor="eval_q">Query</label>
            <input id="eval_q" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="field field-skills">
            <label htmlFor="eval_skills">Skills a good result should have</label>
            <SkillInput id="eval_skills" skills={skills} onChange={setSkills} placeholder="Type a skill and press Enter" />
          </div>
          <div className="composer-row">
            <div className="field">
              <label htmlFor="eval_k">Results to score</label>
              <select id="eval_k" value={topK} onChange={(e) => setTopK(e.target.value)}>
                {[3, 5, 7, 10].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" type="submit" disabled={running || !query.trim()}>
              {running ? "Scoring…" : "Score this query"}
            </button>
          </div>
        </form>

        {error && <p className="error" role="alert">{error}</p>}

        {metrics && (
          <div className="scores">
            <div className="overall">
              <span className="overall-num">{metrics.overall_score.toFixed(1)}</span>
              <span className="overall-of">/ 10</span>
              <p>{verdict(metrics.overall_score)}</p>
            </div>
            <div className="metric-list">
              {METRICS.map(([key, label, hint]) => (
                <div className="metric" key={key}>
                  <div className="metric-top"><span>{label}</span><span>{metrics[key].toFixed(2)}</span></div>
                  <span className="track"><span className="fill fill-meaning" style={{ width: `${metrics[key] * 100}%` }} /></span>
                  <span className="muted small">{hint}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
