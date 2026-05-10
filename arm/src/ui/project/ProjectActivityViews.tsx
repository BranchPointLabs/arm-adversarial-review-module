import { ChatNote, Decision } from "../../core/projectStore";
import { FocusFrame } from "./WorkspaceShell";

export function NotesView(props: { notes: ChatNote[]; onUseChatMode: () => void }) {
  return (
    <FocusFrame
      title="Chat Notes"
      description="Messy thinking lives here. Notes do not become project truth until they are turned into decisions or accepted cards."
      actions={<button type="button" className="secondary" onClick={props.onUseChatMode}>Use chat mode</button>}
    >
      <div className="scrollPanel stack">
        {props.notes.map((note) => (
          <div key={note.id} className="feedItem">
            <div className="feedMeta">{formatTime(note.createdAt)}</div>
            <div>{note.text}</div>
          </div>
        ))}
        {props.notes.length === 0 ? <div className="muted">No chat notes yet.</div> : null}
      </div>
    </FocusFrame>
  );
}

export function DecisionsView(props: { decisions: Decision[]; onOpenUpdate: () => void }) {
  return (
    <FocusFrame
      title="Decisions"
      description="Decisions are explicit project truth. They feed the next context rewrite."
      actions={<button type="button" className="primary" onClick={props.onOpenUpdate}>Update</button>}
    >
      <div className="scrollPanel stack">
        {props.decisions.map((decision) => (
          <div key={decision.id} className="feedItem">
            <div className="feedMeta">{formatTime(decision.createdAt)}</div>
            <div className="reviewCardTitle">{decision.text}</div>
            {decision.reason ? <div className="surfaceCopy">{decision.reason}</div> : null}
          </div>
        ))}
        {props.decisions.length === 0 ? <div className="muted">No decisions yet.</div> : null}
      </div>
    </FocusFrame>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}
