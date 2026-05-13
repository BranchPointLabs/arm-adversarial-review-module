import { ProjectDocument } from "../../core/projectStore";
import DiagramCanvas from "./DiagramCanvas";
import { CopyIcon, ImageIcon, PencilIcon, SaveIcon } from "./ProjectIcons";
import { FocusFrame } from "./WorkspaceShell";

export type DiagramMode = "diagram" | "code";

export type DiagramDocumentViewProps = {
  document: ProjectDocument;
  mode: DiagramMode;
  mermaidDraft: string;
  codeEditing: boolean;
  busy: boolean;
  status: string | null;
  onModeChange: (mode: DiagramMode) => void;
  onDraftChange: (value: string) => void;
  onCodeEditingChange: (editing: boolean) => void;
  onSaveCode: () => void;
  onOpenAddCard: () => void;
};

export default function DiagramDocumentView(props: DiagramDocumentViewProps) {
  return (
    <FocusFrame
      title={props.document.name}
      description="Diagram document"
      actions={
        <div className="row">
          <button
            type="button"
            className="iconButton"
            title="Copy Mermaid"
            aria-label="Copy Mermaid"
            onClick={() => void navigator.clipboard.writeText(props.mermaidDraft)}
          >
            <CopyIcon />
          </button>
          {props.mode === "code" ? (
            <>
              <button
                type="button"
                className={"iconButton" + (props.codeEditing ? " active" : "")}
                title="Edit diagram code"
                aria-label="Edit diagram code"
                disabled={props.busy}
                onClick={() => props.onCodeEditingChange(true)}
              >
                <PencilIcon />
              </button>
              {props.codeEditing ? (
                <button
                  type="button"
                  className="iconButton iconButton-primary"
                  title="Save diagram code"
                  aria-label="Save diagram code"
                  disabled={props.busy}
                  onClick={props.onSaveCode}
                >
                  <SaveIcon />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      }
    >
      <div className="diagramDocument">
        <div className="segmentedControl diagramModeBar">
          {(["diagram", "code"] as DiagramMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={"segmentedPill" + (props.mode === mode ? " active" : "")}
              onClick={() => props.onModeChange(mode)}
              title={mode === "diagram" ? "Diagram view" : "Code view"}
              aria-label={mode === "diagram" ? "Diagram view" : "Code view"}
            >
              {mode === "diagram" ? <ImageIcon /> : "CODE"}
            </button>
          ))}
        </div>
        <div className="diagramViewport">
          {props.mode === "diagram" ? (
            <DiagramCanvas entities={props.document.entities || []} mermaid={props.document.mermaid || ""} />
          ) : (
            <textarea
              className="documentEditor diagramCode"
              value={props.mermaidDraft}
              onChange={(event) => props.onDraftChange(event.target.value)}
              readOnly={!props.codeEditing}
              spellCheck={false}
            />
          )}
        </div>
        <div className="diagramFooter">
          <button type="button" className="primary" onClick={props.onOpenAddCard}>
            Add Card
          </button>
        </div>
      </div>
      {props.status ? <div className="workspaceStatus">{props.status}</div> : null}
    </FocusFrame>
  );
}
