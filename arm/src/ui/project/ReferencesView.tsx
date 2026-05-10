import React from "react";
import { ProjectReference } from "../../core/projectStore";
import ReferenceDropZone from "./ReferenceDropZone";
import { FocusFrame } from "./WorkspaceShell";

export type ReferencesViewProps = {
  references: ProjectReference[];
  repositoryPanelOpen: boolean;
  repositoryInput: string;
  repositoryProcessing: boolean;
  repositoryStatus: string | null;
  filesInputRef: React.RefObject<HTMLInputElement>;
  folderInputRef: React.RefObject<HTMLInputElement>;
  onRepositoryPanelOpenChange: (open: boolean) => void;
  onRepositoryInputChange: (value: string) => void;
  onProcessRepository: () => void;
  onPickedFiles: (files: FileList | null) => void;
  onToggleReference: (reference: ProjectReference) => void;
  onSummarizeReference: (reference: ProjectReference) => void;
  onRemoveReference: (reference: ProjectReference) => void;
};

export default function ReferencesView(props: ReferencesViewProps) {
  return (
    <FocusFrame
      title="References"
      description="Attach files or folders, choose what stays in play, and summarize only the parts that should influence the living context."
      actions={
        <div className="row">
          <button type="button" className="secondary" onClick={() => props.filesInputRef.current?.click()}>
            Add File
          </button>
          <button type="button" className="secondary" onClick={() => props.folderInputRef.current?.click()}>
            Add Folder
          </button>
          <button type="button" className="secondary" onClick={() => props.onRepositoryPanelOpenChange(true)}>
            Add Repository
          </button>
        </div>
      }
    >
      {props.repositoryPanelOpen ? (
        <div className="referenceRepositoryPanel">
          <label className="fieldLabel" htmlFor="repository-reference-input">Repository URL or clone command</label>
          <div className="repositoryInputRow">
            <input
              id="repository-reference-input"
              className="textInput"
              value={props.repositoryInput}
              onChange={(event) => props.onRepositoryInputChange(event.target.value)}
              placeholder="git clone https://github.com/org/repo.git"
              disabled={props.repositoryProcessing}
            />
            <button
              type="button"
              className="primary"
              disabled={props.repositoryProcessing || !props.repositoryInput.trim()}
              onClick={props.onProcessRepository}
            >
              {props.repositoryProcessing ? "Processing..." : "Process Repository"}
            </button>
          </div>
          {props.repositoryStatus ? <div className="status">{props.repositoryStatus}</div> : null}
        </div>
      ) : null}
      <ReferenceDropZone
        onFiles={props.onPickedFiles}
        onPickFiles={() => props.filesInputRef.current?.click()}
      />
      <div className="scrollPanel stack">
        {props.references.map((reference) => (
          <div key={reference.id} className="referenceCard">
            <div className="referenceHeader">
              <div>
                <div className="reviewCardTitle">{reference.fileName}</div>
                <div className="feedMeta">
                  Type: {reference.type === "repository" ? "Repository Summary" : "File"} - Status: Indexed
                </div>
                <div className="feedMeta">{reference.sourceUrl || reference.filePath || "Uploaded reference"}</div>
              </div>
              <label className="referenceToggle">
                <input type="checkbox" checked={reference.isSelected} onChange={() => props.onToggleReference(reference)} />
                <span>Selected</span>
              </label>
            </div>
            <div className="surfaceCopy">
              {reference.summary || "No summary yet."}
            </div>
            <div className="referenceActions">
              <button type="button" className="secondary" onClick={() => props.onSummarizeReference(reference)}>
                Generate Summary
              </button>
              <button type="button" className="secondary" onClick={() => props.onRemoveReference(reference)}>
                Remove
              </button>
            </div>
          </div>
        ))}
        {props.references.length === 0 ? <div className="muted">No references attached yet.</div> : null}
      </div>
    </FocusFrame>
  );
}
