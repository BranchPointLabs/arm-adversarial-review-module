import { ProjectDocument } from "../../core/projectStore";
import DiagramDocumentView, { DiagramDocumentViewProps } from "./DiagramDocumentView";
import { ContextDocumentView, ContextDocumentViewProps, MarkdownDocumentView, MarkdownDocumentViewProps } from "./DocumentViews";
import JsonDocumentEditor from "./JsonDocumentEditor";
import PlanDocumentView, { PlanDocumentViewProps } from "./PlanDocumentView";
import { DecisionsView, NotesView } from "./ProjectActivityViews";
import ReferencesView, { ReferencesViewProps } from "./ReferencesView";

type ViewKey = "context" | "notes" | "decisions" | "references" | "document";

export default function ProjectCenterPane(props: {
  currentView: ViewKey;
  activeDocument: ProjectDocument | null;
  notes: Parameters<typeof NotesView>[0];
  decisions: Parameters<typeof DecisionsView>[0];
  references: ReferencesViewProps;
  diagram: Omit<DiagramDocumentViewProps, "document">;
  jsonDocument: {
    content: string;
    busy: boolean;
    onContentChange: (value: string) => void;
    onCopy: () => Promise<boolean>;
  };
  plan: Omit<PlanDocumentViewProps, "document">;
  markdownDocument: MarkdownDocumentViewProps;
  context: ContextDocumentViewProps;
}) {
  if (props.currentView === "notes") {
    return <NotesView {...props.notes} />;
  }

  if (props.currentView === "decisions") {
    return <DecisionsView {...props.decisions} />;
  }

  if (props.currentView === "references") {
    return <ReferencesView {...props.references} />;
  }

  if (props.currentView === "document") {
    if (props.activeDocument?.type === "diagram") {
      return <DiagramDocumentView {...props.diagram} document={props.activeDocument} />;
    }

    if (props.activeDocument?.type === "json") {
      return <JsonDocumentEditor {...props.jsonDocument} document={props.activeDocument} />;
    }

    if (props.activeDocument?.type === "PLAN") {
      return <PlanDocumentView {...props.plan} document={props.activeDocument} />;
    }

    return <MarkdownDocumentView {...props.markdownDocument} />;
  }

  if (props.activeDocument?.type === "json") {
    return <JsonDocumentEditor {...props.jsonDocument} document={props.activeDocument} />;
  }

  return <ContextDocumentView {...props.context} />;
}
