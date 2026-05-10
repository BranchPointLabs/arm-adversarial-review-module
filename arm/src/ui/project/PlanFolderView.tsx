import React from "react";
import { PlanPage } from "../../core/planPages";
import MarkdownReader from "./MarkdownReader";
import PlanDiagramCanvas from "./PlanDiagramCanvas";
import { PencilIcon, SaveIcon } from "./ProjectIcons";

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
  const editing = page?.kind === "document" && editingPageId === page.id;

  React.useEffect(() => {
    setEditingPageId(null);
    setPageDraft(page?.content || "");
  }, [page?.id]);

  if (!page) {
    return <div className="emptyContextState">No plan pages found.</div>;
  }

  async function saveCurrentPage() {
    if (!page || page.kind !== "document") return;
    await props.onSavePage(page, pageDraft);
    setEditingPageId(null);
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
            <span className="documentType">{item.kind === "diagram" ? "DIAGRAM" : "PAGE"}</span>
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
                <button
                  type="button"
                  className="iconButton iconButton-primary"
                  title="Save page"
                  aria-label="Save page"
                  disabled={props.busy || !editing}
                  onClick={() => void saveCurrentPage()}
                >
                  <SaveIcon />
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
