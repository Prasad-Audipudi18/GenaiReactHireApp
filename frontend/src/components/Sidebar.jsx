const NAV = [
  { id: "search", label: "Find candidates" },
  { id: "upload", label: "Add resumes" },
  { id: "insights", label: "Search quality" },
];

export default function Sidebar({ view, onNavigate, status, statusError, reindexing, onReindex, usingMock }) {
  const ready = status?.hybrid_ready;
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 18c4-9 12-9 16 0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/><circle cx="12" cy="7" r="3" fill="currentColor"/></svg>
        </span>
        <span className="brand-name">HireFlow</span>
      </div>

      <nav className="nav" aria-label="Main">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${view === item.id ? "is-active" : ""}`}
            aria-current={view === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="index-card" aria-label="Index status">
        {statusError ? (
          <p className="index-error">{statusError}</p>
        ) : !status ? (
          <p className="muted">Checking index…</p>
        ) : (
          <>
            <div className="index-line">
              <span className={`dot ${ready ? "dot-ok" : "dot-wait"}`} />
              {ready ? "Ready to search" : "Index not built yet"}
            </div>
            <p className="index-count">
              <strong>{status.pinecone_vector_count}</strong> resumes in Pinecone
            </p>
            <ul className="index-parts">
              <li className={status.resumes_ready ? "on" : ""}>Keyword index (BM25)</li>
              <li className={status.vector_store_ready ? "on" : ""}>Vector store</li>
            </ul>
          </>
        )}
        <button className="btn btn-quiet" onClick={onReindex} disabled={reindexing}>
          {reindexing ? "Re-indexing…" : "Re-index resumes"}
        </button>
      </section>

      {usingMock && <p className="mock-note">Showing sample data. Set VITE_USE_MOCK=false to use your backend.</p>}
    </aside>
  );
}
