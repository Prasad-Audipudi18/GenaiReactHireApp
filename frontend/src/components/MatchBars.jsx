// Shows how a candidate was found: keyword match (BM25) and meaning match (vector),
// which Reciprocal Rank Fusion combines into the hybrid rank.
export default function MatchBars({ bm25, vector }) {
  const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  return (
    <div className="match-bars">
      <div className="match-row">
        <span className="match-label">Keywords</span>
        <span className="track"><span className="fill fill-keyword" style={{ width: pct(bm25) }} /></span>
        <span className="match-val">{bm25.toFixed(2)}</span>
      </div>
      <div className="match-row">
        <span className="match-label">Meaning</span>
        <span className="track"><span className="fill fill-meaning" style={{ width: pct(vector) }} /></span>
        <span className="match-val">{vector.toFixed(2)}</span>
      </div>
    </div>
  );
}
