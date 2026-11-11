import { useState } from "react";
import MatchBars from "./MatchBars";
import FitScore from "./FitScore";

export default function CandidateCard({ rank, candidate, evaluation, evaluating, requiredSkills }) {
  const [open, setOpen] = useState(rank === 1);
  const wanted = new Set(requiredSkills.map((s) => s.toLowerCase()));
  const hasEval = Boolean(evaluation);

  return (
    <article className={`candidate ${open ? "is-open" : ""}`}>
      <button className="candidate-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="rank">{rank}</span>
        <span className="who">
          <span className="who-name">{candidate.name}</span>
          <span className="who-meta">
            {candidate.location || "Location unknown"}
            {candidate.experience != null && <> &nbsp;/&nbsp; {candidate.experience} yrs</>}
          </span>
        </span>
        <MatchBars bm25={candidate.bm25_score} vector={candidate.vector_score} />
        <FitScore score={evaluation?.fit_score} loading={evaluating && !hasEval} />
        <span className="chev" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="candidate-body">
          <div className="skills">
            {candidate.skills.map((s) => (
              <span key={s} className={`skill ${wanted.has(s.toLowerCase()) ? "skill-hit" : ""}`}>{s}</span>
            ))}
          </div>

          {hasEval ? (
            <div className="review">
              <p className="review-summary">{evaluation.summary}</p>
              <div className="review-cols">
                <div>
                  <h4>Strengths</h4>
                  <ul>{evaluation.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
                <div>
                  <h4>Gaps</h4>
                  <ul className="gaps">{evaluation.gaps.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              </div>
              {evaluation.risks?.length > 0 && (
                <p className="risk">Watch for: {evaluation.risks.join("; ")}</p>
              )}
            </div>
          ) : evaluating ? (
            <p className="muted">Gemini is reviewing this resume against the job…</p>
          ) : (
            <p className="muted">AI review runs for the top 5 matches only.</p>
          )}

          {candidate.text && (
            <details className="preview">
              <summary>Resume excerpt</summary>
              <p>{candidate.text}</p>
            </details>
          )}
          <p className="fusion">Hybrid score (RRF) {candidate.combined_score.toFixed(4)}</p>
        </div>
      )}
    </article>
  );
}
