import { ChatNote, Decision, ProjectDocument, ProjectReference } from "../../core/projectStore";
import { ImageIcon, TrashIcon } from "./ProjectIcons";

export default function WorkspaceSidebar(props: {
  navCollapsed: boolean;
  projectName: string;
  projectPath: string;
  currentView: string;
  routeDocumentId: string | null;
  activeDocument: ProjectDocument | null;
  sourceDocuments: ProjectDocument[];
  planDocuments: ProjectDocument[];
  references: ProjectReference[];
  decisions: Decision[];
  stickyNotes: ChatNote[];
  busy: boolean;
  onToggleCollapsed: () => void;
  onNavigate: (path: string) => void;
  onAddDocument: () => void;
  onDeleteDiagram: (document: ProjectDocument) => void;
  onDeletePrd: (document: ProjectDocument) => void;
  onDeletePlan: (document: ProjectDocument) => void;
}) {
  const projectRoute = encodeURIComponent(props.projectPath);

  return (
    <aside className="navPane workspaceSidebar" aria-label="Project navigation">
      <div className="projectLine">
        {!props.navCollapsed ? <div className="projectNameLine">{props.projectName}</div> : null}
        <button
          type="button"
          className="iconButton"
          aria-label={props.navCollapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={props.onToggleCollapsed}
        >
          {props.navCollapsed ? ">" : "<"}
        </button>
      </div>

      {!props.navCollapsed ? (
        <>
          <div className="workspaceNavBlock">
            <div className="workspaceNavLabel">Project</div>
            <button
              type="button"
              className={"workspaceNavItem workspaceProjectContextButton" + (props.currentView === "context" ? " active" : "")}
              onClick={() => props.onNavigate(`/p/${projectRoute}/context`)}
            >
              Context: {props.activeDocument?.name || "No document selected"}
            </button>
          </div>

          <div className="workspaceNavBlock workspaceNavFill">
            <div className="workspaceNavLabel">Documents</div>
            <div className="documentList" aria-label="Documents">
              {props.sourceDocuments.map((document) => (
                document.type === "diagram" || document.type === "PRD" ? (
                  <div key={document.id} className={"documentNavRow" + (props.routeDocumentId === document.id ? " active" : "")}>
                    <button
                      type="button"
                      className="documentNavItem"
                      onClick={() => props.onNavigate(`/p/${projectRoute}/documents/${document.id}`)}
                    >
                      <span className="documentType" title={document.type === "diagram" ? "Diagram" : document.type}>
                        {document.type === "diagram" ? <ImageIcon /> : document.type}
                      </span>
                      <span className="documentName">{document.name}</span>
                    </button>
                    <button
                      type="button"
                      className="iconButton dangerIconButton documentDeleteButton"
                      title={document.type === "diagram" ? "Delete diagram" : "Delete PRD"}
                      aria-label={`Delete ${document.type === "diagram" ? "diagram" : "PRD"} ${document.name}`}
                      disabled={props.busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (document.type === "diagram") props.onDeleteDiagram(document);
                        else props.onDeletePrd(document);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ) : (
                  <button
                    key={document.id}
                    type="button"
                    className={"documentNavItem" + (props.routeDocumentId === document.id ? " active" : "")}
                    onClick={() => props.onNavigate(`/p/${projectRoute}/documents/${document.id}`)}
                  >
                    <span className="documentType">{document.type}</span>
                    <span className="documentName">{document.name}</span>
                  </button>
                )
              ))}
              {props.sourceDocuments.length === 0 ? <div className="documentNavEmpty">No documents yet</div> : null}
            </div>

            <div className="workspaceNavLabel workspaceNavLabelPrimary">References</div>
            <div className="documentList" aria-label="References">
              {props.references.map((reference) => (
                <button
                  key={reference.id}
                  type="button"
                  className={"documentNavItem referenceNavItem" + (props.currentView === "references" ? " active" : "")}
                  onClick={() => props.onNavigate(`/p/${projectRoute}/references`)}
                  title={reference.fileName}
                >
                  <span className="documentType">REF</span>
                  <span className="documentName">{reference.fileName}</span>
                </button>
              ))}
              {props.references.length === 0 ? <div className="documentNavEmpty">No references yet</div> : null}
            </div>

            <div className="workspaceNavLabel">Plans</div>
            <div className="documentList" aria-label="Plans">
              {props.planDocuments.map((document) => (
                <div key={document.id} className={"documentNavRow" + (props.routeDocumentId === document.id ? " active" : "")}>
                  <button
                    type="button"
                    className="documentNavItem"
                    onClick={() => props.onNavigate(`/p/${projectRoute}/documents/${document.id}`)}
                  >
                    <span className="documentType">PLAN</span>
                    <span className="documentName">{document.name}</span>
                  </button>
                  <button
                    type="button"
                    className="iconButton dangerIconButton documentDeleteButton"
                    title="Delete plan"
                    aria-label={`Delete plan ${document.name}`}
                    disabled={props.busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onDeletePlan(document);
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
              {props.planDocuments.length === 0 ? <div className="documentNavEmpty">No plans yet</div> : null}
            </div>

            <div className="workspaceNavLabel">Decisions</div>
            <div className="documentList" aria-label="Decisions">
              {props.decisions.slice(0, 5).map((decision) => (
                <button
                  key={decision.id}
                  type="button"
                  className={"documentNavItem decisionNavItem" + (props.currentView === "decisions" ? " active" : "")}
                  onClick={() => props.onNavigate(`/p/${projectRoute}/decisions`)}
                  title={decision.text}
                >
                  <span className="documentType">DEC</span>
                  <span className="documentName">{decision.text}</span>
                </button>
              ))}
              {props.decisions.length === 0 ? <div className="documentNavEmpty">No decisions yet</div> : null}
            </div>

            <div className="workspaceNavLabel">Notes</div>
            <div className="documentList" aria-label="Notes">
              {props.stickyNotes.slice(0, 5).map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className={"documentNavItem noteNavItem" + (props.currentView === "notes" ? " active" : "")}
                  onClick={() => props.onNavigate(`/p/${projectRoute}/notes`)}
                  title={note.text}
                >
                  <span className="documentType">NOTE</span>
                  <span className="documentName">{note.text}</span>
                </button>
              ))}
              {props.stickyNotes.length === 0 ? <div className="documentNavEmpty">No notes yet</div> : null}
            </div>
          </div>

          <div className="documentNavFooter">
            <button type="button" className="addDocumentButton" onClick={props.onAddDocument}>
              Add Document
            </button>
          </div>
        </>
      ) : null}
    </aside>
  );
}
