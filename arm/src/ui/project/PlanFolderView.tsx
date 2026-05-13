import React from "react";
import { PlanPage } from "../../core/planPages";
import MarkdownReader from "./MarkdownReader";
import PlanDiagramCanvas from "./PlanDiagramCanvas";
import { EyeIcon, ImageIcon, PencilIcon } from "./ProjectIcons";

export default function PlanFolderView(props: {
  pages: PlanPage[];
  activePageIndex: number;
  activePage: PlanPage | undefined;
  onPageChange: (index: number) => void;
  busy: boolean;
  onSavePage: (page: PlanPage, content: string) => Promise<void>;
}) {
  const page = props.activePage || props.pages[0];
  const [editingPageId, setEditingPageId] = React.useState<string | null>(null);
  const [pageDraft, setPageDraft] = React.useState("");
  const onSavePageRef = React.useRef(props.onSavePage);
  const editing = page?.kind === "document" && editingPageId === page.id;

  React.useEffect(() => {
    onSavePageRef.current = props.onSavePage;
  }, [props.onSavePage]);

  React.useEffect(() => {
    setEditingPageId(null);
    setPageDraft(page?.content || "");
  }, [page?.id]);

  React.useEffect(() => {
    if (!page || page.kind !== "document" || !editing || pageDraft === page.content) return;
    const timeoutId = window.setTimeout(() => {
      void onSavePageRef.current(page, pageDraft);
    }, 700);
    return () => window.clearTimeout(timeoutId);
  }, [editing, page?.content, page?.id, page?.kind, pageDraft]);

  if (!page) {
    return <div className="emptyContextState">No plan pages found.</div>;
  }

  return (
    <div className="planFolder">
      <div className="planPageRail" aria-label="Plan pages">
        {props.pages.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={"planPageTab" + (index === props.activePageIndex ? " active" : "")}
            onClick={() => props.onPageChange(index)}
          >
            <span className="documentType" title={item.kind === "diagram" ? "Diagram" : "Page"}>
              {item.kind === "diagram" ? <ImageIcon /> : "PAGE"}
            </span>
            <span className="documentName">{item.title}</span>
          </button>
        ))}
      </div>
      <div className="planPageViewport">
        <div className="planPageHeader">
          <div className="surfaceTitle">{page.title}</div>
          <div className="planPageSubheader">
            <div className="feedMeta">{page.kind === "diagram" ? "Mermaid diagram page" : "Plan document page"}</div>
            {page.kind === "document" ? (
              <div className="row">
                <button
                  type="button"
                  className={"iconButton" + (!editing ? " active" : "")}
                  title="Reading view"
                  aria-label="Reading view"
                  disabled={props.busy}
                  onClick={() => setEditingPageId(null)}
                >
                  <EyeIcon />
                </button>
                <button
                  type="button"
                  className={"iconButton" + (editing ? " active" : "")}
                  title="Edit page"
                  aria-label="Edit page"
                  disabled={props.busy}
                  onClick={() => {
                    setEditingPageId(page.id);
                    setPageDraft(page.content);
                  }}
                >
                  <PencilIcon />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {page.kind === "diagram" ? (
          <PlanDiagramCanvas mermaid={page.content} title={page.title} context={page.context || ""} />
        ) : editing ? (
          <textarea
            className="documentEditor planPageEditor"
            value={pageDraft}
            onChange={(event) => setPageDraft(event.target.value)}
            spellCheck={false}
          />
        ) : (
          <MarkdownReader markdown={page.content} />
        )}
      </div>
    </div>
  );
}
