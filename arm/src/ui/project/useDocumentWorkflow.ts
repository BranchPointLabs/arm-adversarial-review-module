import React from "react";
import { PlanPage, replacePlanPageMarkdown } from "../../core/planPages";
import { DocumentType, ProjectDocument, projectStore } from "../../core/projectStore";

export function useDocumentWorkflow(props: {
  projectPath: string;
  activeDocument: ProjectDocument | null;
  documentMarkdown: string;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string | null) => void;
  setErrorModalMessage: (message: string | null) => void;
  setActiveDocument: (document: ProjectDocument | null) => void;
  setDocumentMarkdown: (markdown: string) => void;
  setDocumentMarkdownEditing: (editing: boolean) => void;
  setActivePlanPageIndex: (index: number) => void;
  setDiagramMermaidDraft: (markdown: string) => void;
  setDiagramCodeEditing: (editing: boolean) => void;
  setPlanGenerating: (generating: boolean) => void;
  refreshAll: () => Promise<void>;
  navigate: (path: string) => void;
}) {
  const [addDocumentOpen, setAddDocumentOpen] = React.useState(false);
  const [newDocumentName, setNewDocumentName] = React.useState("");
  const [newDocumentKind, setNewDocumentKind] = React.useState<"text" | "diagram" | "json">("text");
  const [newDocumentType, setNewDocumentType] = React.useState<DocumentType>("IDEA");
  const [newDocumentStatus, setNewDocumentStatus] = React.useState<string | null>(null);

  async function saveDocumentNow() {
    if (!props.activeDocument) return;
    props.setBusy(true);
    try {
      await projectStore.saveDocument(props.projectPath, props.activeDocument.id, props.documentMarkdown);
      props.setDocumentMarkdownEditing(false);
      props.setStatus("Document saved.");
      await props.refreshAll();
    } catch (error: any) {
      props.setStatus(typeof error === "string" ? error : error?.message || "Save failed.");
    } finally {
      props.setBusy(false);
    }
  }

  async function savePlanPageNow(page: PlanPage, content: string) {
    if (!props.activeDocument || props.activeDocument.type !== "PLAN" || page.kind !== "document") return;
    const nextMarkdown = replacePlanPageMarkdown(props.documentMarkdown, page, content);
    props.setBusy(true);
    try {
      await projectStore.saveDocument(props.projectPath, props.activeDocument.id, nextMarkdown);
      props.setDocumentMarkdown(nextMarkdown);
      props.setStatus(`${page.title} saved.`);
      await props.refreshAll();
    } catch (error: any) {
      props.setStatus(typeof error === "string" ? error : error?.message || "Plan page save failed.");
    } finally {
      props.setBusy(false);
    }
  }

  async function deletePlanNow(document: ProjectDocument) {
    if (document.type !== "PLAN") return;
    const confirmed = window.confirm(`Delete plan "${document.name}"?`);
    if (!confirmed) return;

    props.setBusy(true);
    try {
      await projectStore.deleteDocument(props.projectPath, document.id);
      props.setActiveDocument(null);
      props.setDocumentMarkdown("");
      props.setActivePlanPageIndex(0);
      await props.refreshAll();
      props.navigate(`/p/${encodeURIComponent(props.projectPath)}/context`);
      props.setStatus("Plan deleted.");
    } catch (error: any) {
      props.setStatus(typeof error === "string" ? error : error?.message || "Delete failed.");
    } finally {
      props.setBusy(false);
    }
  }

  async function deleteDiagramNow(document: ProjectDocument) {
    if (document.type !== "diagram") return;
    const confirmed = window.confirm(`Delete diagram "${document.name}"?`);
    if (!confirmed) return;

    props.setBusy(true);
    try {
      await projectStore.deleteDocument(props.projectPath, document.id);
      props.setActiveDocument(null);
      props.setDocumentMarkdown("");
      props.setDiagramMermaidDraft("");
      props.setDiagramCodeEditing(false);
      await props.refreshAll();
      props.navigate(`/p/${encodeURIComponent(props.projectPath)}/context`);
      props.setStatus("Diagram deleted.");
    } catch (error: any) {
      props.setStatus(typeof error === "string" ? error : error?.message || "Delete failed.");
    } finally {
      props.setBusy(false);
    }
  }

  async function deletePrdNow(document: ProjectDocument) {
    if (document.type !== "PRD") return;
    await deleteDocumentNow(document, "PRD", "PRD deleted.");
  }

  async function deleteIdeaNow(document: ProjectDocument) {
    if (document.type !== "IDEA") return;
    await deleteDocumentNow(document, "idea", "Idea deleted.");
  }

  async function deleteJsonNow(document: ProjectDocument) {
    if (document.type !== "json") return;
    await deleteDocumentNow(document, "JSON document", "JSON document deleted.");
  }

  async function deleteDocumentNow(document: ProjectDocument, label: string, successMessage: string) {
    const confirmed = window.confirm(`Delete ${label} "${document.name}"?`);
    if (!confirmed) return;

    props.setBusy(true);
    try {
      await projectStore.deleteDocument(props.projectPath, document.id);
      props.setActiveDocument(null);
      props.setDocumentMarkdown("");
      await props.refreshAll();
      props.navigate(`/p/${encodeURIComponent(props.projectPath)}/context`);
      props.setStatus(successMessage);
    } catch (error: any) {
      props.setStatus(typeof error === "string" ? error : error?.message || "Delete failed.");
    } finally {
      props.setBusy(false);
    }
  }

  async function copyDocumentNow() {
    if (!props.activeDocument) return false;
    try {
      await navigator.clipboard.writeText(props.documentMarkdown);
      return true;
    } catch (error: any) {
      props.setErrorModalMessage(typeof error === "string" ? error : error?.message || "Copy failed.");
      return false;
    }
  }

  async function createDocument() {
    const trimmed = newDocumentName.trim();
    if (trimmed.length < 2) {
      setNewDocumentStatus("Document name too short.");
      return;
    }

    props.setBusy(true);
    try {
      const documentType = newDocumentKind === "diagram" ? "diagram" : newDocumentKind === "json" ? "json" : newDocumentType;
      const document = await projectStore.createDocument(props.projectPath, trimmed, documentType);
      setAddDocumentOpen(false);
      setNewDocumentName("");
      setNewDocumentKind("text");
      setNewDocumentType("IDEA");
      setNewDocumentStatus(null);
      await props.refreshAll();
      props.navigate(`/p/${encodeURIComponent(props.projectPath)}/documents/${document.id}`);
    } catch (error: any) {
      setNewDocumentStatus(typeof error === "string" ? error : error?.message || "Create failed.");
    } finally {
      props.setBusy(false);
      props.setPlanGenerating(false);
    }
  }

  return {
    addDocumentOpen,
    newDocumentName,
    newDocumentKind,
    newDocumentType,
    newDocumentStatus,
    setAddDocumentOpen,
    setNewDocumentName,
    setNewDocumentKind,
    setNewDocumentType,
    saveDocumentNow,
    savePlanPageNow,
    deletePlanNow,
    deleteDiagramNow,
    deleteIdeaNow,
    deletePrdNow,
    deleteJsonNow,
    copyDocumentNow,
    createDocument,
  };
}
