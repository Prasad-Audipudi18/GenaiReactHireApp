import { useCallback, useEffect, useState } from "react";
import { api, USING_MOCK } from "./api/client";
import Sidebar from "./components/Sidebar";
import SearchPage from "./pages/SearchPage";
import UploadPage from "./pages/UploadPage";
import InsightsPage from "./pages/InsightsPage";

const VIEWS = ["search", "upload", "insights"];
const viewFromHash = () => {
  const v = window.location.hash.replace("#", "");
  return VIEWS.includes(v) ? v : "search";
};

export default function App() {
  const [view, setView] = useState(viewFromHash);
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [reindexing, setReindexing] = useState(false);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await api.getStatus());
      setStatusError("");
    } catch (e) {
      setStatusError(e.message);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const navigate = (v) => {
    window.location.hash = v;
    setView(v);
  };

  const reindex = async () => {
    setReindexing(true);
    try {
      await api.reindex();
      await refreshStatus();
    } catch (e) {
      setStatusError(e.message);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="shell">
      <Sidebar
        view={view}
        onNavigate={navigate}
        status={status}
        statusError={statusError}
        reindexing={reindexing}
        onReindex={reindex}
        usingMock={USING_MOCK}
      />
      <main className="main">
        {view === "search" && <SearchPage ready={status?.resumes_ready} onGoUpload={() => navigate("upload")} />}
        {view === "upload" && <UploadPage onIndexed={refreshStatus} />}
        {view === "insights" && <InsightsPage />}
      </main>
    </div>
  );
}
