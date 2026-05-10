import { ProjectDocument } from "../../core/projectStore";
import MarkdownReader from "./MarkdownReader";
import { CopyIcon, LightningIcon, MegaphoneIcon, PencilIcon, PlusIcon, SaveIcon } from "./ProjectIcons";
import { FocusFrame } from "./WorkspaceShell";

export type MarkdownDocumentViewProps = {
  document: ProjectDocument | null;
  markdown: string;
  editing: boolean;
  busy: boolean;
  reviewGenerating: boolean;
  sourceDocumentCount: number;
  onOpenUpdate: () => void;
  onGenerateScrumReview: () => void;
  onOpenPlanning: () => void;
  onMarkdownChange: (value: string) => void;
  onEditingChange: (editing: boolean) => void;
  onCopy: () => void;
  onSave: () => void;
  isPlanningSourceDocument: (document: ProjectDocument | null, markdown: string) => boolean;
};

export function MarkdownDocumentView(props: MarkdownDocumentViewProps) {
  const planningSource = props.isPlanningSourceDocument(props.document, props.markdown);

  return (
    <FocusFrame
      title={props.document?.name || "Document"}
      description={props.document ? `${props.document.type} document` : "Select a document from the left column."}
      actions={
        <div className="row">
          {planningSource ? (
            <>
              <button
                type="button"
                className="iconButton"
                title="Update document"
                aria-label="Update document"
                disabled={!props.document}
                onClick={props.onOpenUpdate}
              >
                <PlusIcon />
              </button>
              {props.document?.type === "PRD" ? (
                <button
                  type="button"
                  className={"iconButton" + (props.editing ? " active" : "")}
                  title="Edit markdown"
                  aria-label="Edit markdown"
                  disabled={!props.document}
                  onClick={() => props.onEditingChange(true)}
                >
                  <PencilIcon />
                </button>
              ) : null}
              <button
                type="button"
                className="iconButton"
                title="Generate Scrum Review Audio"
                aria-label="Generate Scrum Review Audio"
                disabled={!props.document || props.busy || props.reviewGenerating}
                onClick={props.onGenerateScrumReview}
              >
                <MegaphoneIcon />
              </button>
              <button
                type="button"
                className="iconButton"
                title="Generate plan"
                aria-label="Generate plan"
                disabled={props.sourceDocumentCount === 0}
                onClick={props.onOpenPlanning}
              >
                <LightningIcon />
              </button>
            </>
          ) : null}
          <DocumentCopySaveActions
            disabled={!props.document}
            saveDisabled={!props.document || props.busy}
            onCopy={props.onCopy}
            onSave={props.onSave}
          />
        </div>
      }
    >
      {props.document?.type === "PRD" && !props.editing ? (
        <MarkdownReader markdown={props.markdown} />
      ) : (
        <textarea
          className="documentEditor"
          value={props.markdown}
          onChange={(event) => props.onMarkdownChange(event.target.value)}
          disabled={!props.document}
          spellCheck={false}
        />
      )}
    </FocusFrame>
  );
}

export type ContextDocumentViewProps = {
  document: ProjectDocument | null;
  markdown: string;
  busy: boolean;
  status: string | null;
  sourceDocumentCount: number;
  onOpenUpdate: () => void;
  onOpenPlanning: () => void;
  onMarkdownChange: (value: string) => void;
  onCopy: () => void;
  onSave: () => void;
};

export function ContextDocumentView(props: ContextDocumentViewProps) {
  return (
    <FocusFrame
      title={props.document?.name || "No context document yet"}
      description={
        props.document
          ? "The selected document is the context source of truth for review and update flows."
          : "This project has no context yet. Create a document to establish the working truth."
      }
      actions={
        <div className="row">
          <button
            type="button"
            className="iconButton"
            title="Update document"
            aria-label="Update document"
            disabled={!props.document}
            onClick={props.onOpenUpdate}
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className="iconButton"
            title="Generate plan"
            aria-label="Generate plan"
            disabled={props.sourceDocumentCount === 0}
            onClick={props.onOpenPlanning}
          >
            <LightningIcon />
          </button>
          <DocumentCopySaveActions
            disabled={!props.document}
            saveDisabled={props.busy || !props.document}
            onCopy={props.onCopy}
            onSave={props.onSave}
          />
        </div>
      }
    >
      {props.document ? (
        <textarea
          className="documentEditor"
          value={props.markdown}
          onChange={(event) => props.onMarkdownChange(event.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="emptyContextState">
          <div className="surfaceTitle">No context document</div>
          <div className="surfaceCopy">
            Create a document first. That selected document becomes the source of truth for current queries.
          </div>
        </div>
      )}
      {props.status ? <div className="workspaceStatus">{props.status}</div> : null}
    </FocusFrame>
  );
}

function DocumentCopySaveActions(props: {
  disabled: boolean;
  saveDisabled: boolean;
  onCopy: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <button type="button" className="iconButton" title="Copy document" aria-label="Copy document" disabled={props.disabled} onClick={props.onCopy}>
        <CopyIcon />
      </button>
      <button
        type="button"
        className="iconButton iconButton-primary"
        title="Save document"
        aria-label="Save document"
        disabled={props.saveDisabled}
        onClick={props.onSave}
      >
        <SaveIcon />
      </button>
    </>
  );
}
