import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ChatNote, Decision, projectStore } from "../../core/projectStore";

export default function Inputs() {
  const params = useParams();
  const projectPath = params.projectPath ? decodeURIComponent(params.projectPath) : "";
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState("");
  const [notes, setNotes] = useState<ChatNote[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [projectPath]);

  async function refresh() {
    setStatus(null);
    try {
      setNotes(await projectStore.listChatNotes(projectPath));
      setDecisions(await projectStore.listDecisions(projectPath));
    } catch (e: any) {
      setStatus(typeof e === "string" ? e : e?.message || "Load failed.");
    }
  }

  async function addNote() {
    const text = note.trim();
    if (!text) return;
    setStatus(null);
    try {
      await projectStore.addChatNote(projectPath, text, null);
      setNote("");
      await refresh();
    } catch (e: any) {
      setStatus(typeof e === "string" ? e : e?.message || "Add note failed.");
    }
  }

  async function addOneDecision() {
    const text = decision.trim();
    if (!text) return;
    setStatus(null);
    try {
      await projectStore.addDecision(projectPath, text, null);
      setDecision("");
      await refresh();
    } catch (e: any) {
      setStatus(typeof e === "string" ? e : e?.message || "Add decision failed.");
    }
  }

  return (
    <div className="page">
      <div className="grid2">
        <div className="surfaceCard">
          <h2>Chat Note</h2>
          <textarea className="miniEditor" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="row right">
            <button className="primary" onClick={addNote} disabled={!note.trim()}>
              Add Note
            </button>
          </div>
        </div>

        <div className="surfaceCard">
          <h2>Decision</h2>
          <textarea className="miniEditor" value={decision} onChange={(e) => setDecision(e.target.value)} />
          <div className="row right">
            <button className="primary" onClick={addOneDecision} disabled={!decision.trim()}>
              Add Decision
            </button>
          </div>
        </div>
      </div>

      {status ? <div className="status">{status}</div> : null}

      <div className="grid2">
        <div className="surfaceCard">
          <h2>Recent Notes</h2>
          <div className="feed">
            {notes.map((n) => (
              <div key={n.id} className="feedItem">
                <div className="feedMeta">{new Date(n.createdAt).toLocaleString()}</div>
                <div>{n.text}</div>
              </div>
            ))}
            {notes.length === 0 ? <div className="muted">None yet.</div> : null}
          </div>
        </div>

        <div className="surfaceCard">
          <h2>Recent Decisions</h2>
          <div className="feed">
            {decisions.map((d) => (
              <div key={d.id} className="feedItem">
                <div className="feedMeta">{new Date(d.createdAt).toLocaleString()}</div>
                <div>{d.text}</div>
              </div>
            ))}
            {decisions.length === 0 ? <div className="muted">None yet.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
