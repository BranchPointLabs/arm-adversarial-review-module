import { ProjectDocument } from "../../core/projectStore";
import MarkdownReader from "./MarkdownReader";
import { CopyIcon, EyeIcon, LightningIcon, MegaphoneIcon, PencilIcon, PlusIcon } from "./ProjectIcons";
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
          <DocumentReadEditActions
            disabled={!props.document}
            editing={props.editing}
            onCopy={props.onCopy}
            onEditingChange={props.onEditingChange}
          />
        </div>
      }
    >
      {!props.editing ? (
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
          <button type="button" className="iconButton" title="Copy document" aria-label="Copy document" disabled={!props.document} onClick={props.onCopy}>
            <CopyIcon />
          </button>
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

function DocumentReadEditActions(props: {
  disabled: boolean;
  editing: boolean;
  onCopy: () => void;
  onEditingChange: (editing: boolean) => void;
}) {
  return (
    <>
      <button type="button" className="iconButton" title="Copy document" aria-label="Copy document" disabled={props.disabled} onClick={props.onCopy}>
        <CopyIcon />
      </button>
      <button
        type="button"
        className={"iconButton" + (props.editing ? " active" : "")}
        title={props.editing ? "Reading view" : "Edit markdown"}
        aria-label={props.editing ? "Switch to reading view" : "Switch to edit mode"}
        disabled={props.disabled}
        onClick={() => props.onEditingChange(!props.editing)}
      >
        {props.editing ? <EyeIcon /> : <PencilIcon />}
      </button>
    </>
  );
}
