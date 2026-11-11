// Circular gauge for the Gemini fit score (0–100).
export default function FitScore({ score, loading }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const tone = score >= 80 ? "fit-high" : score >= 60 ? "fit-mid" : "fit-low";
  return (
    <div className={`fit ${loading ? "is-loading" : tone}`} role="img"
      aria-label={loading ? "AI review in progress" : `AI fit score ${score} out of 100`}>
      <svg viewBox="0 0 56 56" width="56" height="56">
        <circle cx="28" cy="28" r={r} className="fit-track" />
        {!loading && score != null && (
          <circle cx="28" cy="28" r={r} className="fit-arc"
            strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 28 28)" />
        )}
      </svg>
      <span className="fit-num">{loading ? "" : score ?? "–"}</span>
    </div>
  );
}
