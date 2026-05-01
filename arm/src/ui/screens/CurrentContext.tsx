import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { projectStore } from "../../core/projectStore";

export default function CurrentContext() {
  const params = useParams();
  const projectPath = params.projectPath ? decodeURIComponent(params.projectPath) : "";
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, [projectPath]);

  async function load() {
    setBusy(true);
    setStatus(null);
    try {
      setMarkdown(await projectStore.loadCurrentContext(projectPath));
    } catch (e: any) {
      setStatus(typeof e === "string" ? e : e?.message || "Load failed.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      await projectStore.saveCurrentContext(projectPath, markdown);
      setStatus("Saved.");
      setTimeout(() => setStatus(null), 1500);
    } catch (e: any) {
      setStatus(typeof e === "string" ? e : e?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="surfaceCard contextSurface">
        <textarea
          className="editor"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          spellCheck={false}
        />
        <div className="row right">
          <button className="secondary" disabled={busy} onClick={load}>
            Reload
          </button>
          <button className="primary" disabled={busy} onClick={save}>
            Save
          </button>
        </div>
        {status ? <div className="status">{status}</div> : null}
      </div>
    </div>
  );
}
