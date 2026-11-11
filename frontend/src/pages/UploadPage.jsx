import { useRef, useState } from "react";
import { api } from "../api/client";

export default function UploadPage({ onIndexed }) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const addFiles = (list) => {
    const pdfs = [...list].filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length < list.length) setError("Only PDF files can be added. Other files were skipped.");
    else setError("");
    setFiles((prev) => [...prev, ...pdfs.filter((p) => !prev.some((f) => f.name === p.name))]);
    setOutcome(null);
  };

  const upload = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.upload(files);
      setOutcome(data);
      setFiles([]);
      onIndexed();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Add resumes</h1>
        <p className="lede">Gemini reads each PDF to pull out name, skills, location and experience, then indexes it for search.</p>
      </header>

      <div
        className={`drop ${dragging ? "is-drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <p className="drop-title">Drop PDF resumes here</p>
        <button className="btn btn-quiet" onClick={() => inputRef.current?.click()}>Choose files</button>
        <input ref={inputRef} type="file" accept="application/pdf" multiple hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {files.length > 0 && (
        <div className="file-list">
          <ul>
            {files.map((f) => (
              <li key={f.name}>
                <span>{f.name}</span>
                <span className="muted">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                <button className="link" onClick={() => setFiles(files.filter((x) => x !== f))}>Remove</button>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary" onClick={upload} disabled={busy}>
            {busy ? "Indexing…" : `Index ${files.length} resume${files.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {outcome && (
        <div className="outcome">
          <p><strong>Indexed {outcome.indexed} of {outcome.results.length}.</strong> They're searchable now.</p>
          <ul>
            {outcome.results.map((r) => (
              <li key={r.filename} className={r.ok ? "ok" : "fail"}>{r.filename}: {r.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
