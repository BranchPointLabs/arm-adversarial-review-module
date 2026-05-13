import { PlanPage, buildPlanPages } from "../../core/planPages";
import { ProjectDocument } from "../../core/projectStore";
import PlanFolderView from "./PlanFolderView";
import { CopyIcon, LightningIcon, MegaphoneIcon, TrashIcon } from "./ProjectIcons";
import { FocusFrame } from "./WorkspaceShell";

export type PlanDocumentViewProps = {
  document: ProjectDocument;
  markdown: string;
  activePageIndex: number;
  busy: boolean;
  reviewGenerating: boolean;
  onActivePageChange: (index: number) => void;
  onSavePage: (page: PlanPage, content: string) => Promise<void>;
  onDelete: (document: ProjectDocument) => void;
  onRerun: (document: ProjectDocument) => void;
  onGenerateScrumReview: () => void;
  onCopy: () => void;
};

export default function PlanDocumentView(props: PlanDocumentViewProps) {
  const planPages = buildPlanPages(props.markdown);
  const activePage = planPages[Math.min(props.activePageIndex, Math.max(0, planPages.length - 1))];

  return (
    <FocusFrame
      title={props.document.name}
      description="Plan folder"
      actions={
        <div className="row">
          <button
            type="button"
            className="iconButton dangerIconButton"
            title="Delete plan"
            aria-label="Delete plan"
            disabled={props.busy}
            onClick={() => props.onDelete(props.document)}
          >
            <TrashIcon />
          </button>
          <button
            type="button"
            className="iconButton"
            title="Re-plan"
            aria-label="Re-plan"
            onClick={() => props.onRerun(props.document)}
          >
            <LightningIcon />
          </button>
          <button
            type="button"
            className="iconButton"
            title="Generate Scrum Review Audio"
            aria-label="Generate Scrum Review Audio"
            disabled={props.busy || props.reviewGenerating}
            onClick={props.onGenerateScrumReview}
          >
            <MegaphoneIcon />
          </button>
          <button type="button" className="iconButton" title="Copy plan" aria-label="Copy plan" onClick={props.onCopy}>
            <CopyIcon />
          </button>
        </div>
      }
    >
      <PlanFolderView
        pages={planPages}
        activePageIndex={props.activePageIndex}
        onPageChange={props.onActivePageChange}
        activePage={activePage}
        busy={props.busy}
        onSavePage={props.onSavePage}
      />
    </FocusFrame>
  );
}
