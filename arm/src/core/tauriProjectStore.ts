import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  AgentCard,
  ChatNote,
  Decision,
  DiagramEntity,
  DocumentType,
  NewAgentCardInput,
  NewReferenceInput,
  Project,
  ProjectDocument,
  ProjectReference,
  ProjectStore,
  ReviewSession,
  RetrievedMemoryChunk,
} from "./types";

export function isTauriRuntimeAvailable() {
  return isTauri();
}

export const tauriProjectStore: ProjectStore = {
  runtime: "desktop",
  listProjects: () => invoke<Project[]>("list_projects"),
  createProject: (name) => invoke<Project>("create_project", { name }),
  deleteProject: (projectPath) => invoke<void>("delete_project", { projectPath }),
  listDocuments: (projectPath) => invoke<ProjectDocument[]>("list_documents", { projectPath }),
  createDocument: (projectPath, name, type: DocumentType) =>
    invoke<ProjectDocument>("create_document", { projectPath, name, documentType: type }),
  loadDocument: (projectPath, documentId) => invoke<ProjectDocument>("load_document", { projectPath, documentId }),
  saveDocument: (projectPath, documentId, markdown) =>
    invoke<void>("save_document", { projectPath, documentId, markdown }),
  deleteDocument: (projectPath, documentId) => invoke<void>("delete_document", { projectPath, documentId }),
  saveDiagramDocument: (projectPath, documentId, entities: DiagramEntity[]) =>
    invoke<ProjectDocument>("save_diagram_document", { projectPath, documentId, entities }),
  saveDiagramMermaid: (projectPath, documentId, mermaid) =>
    invoke<ProjectDocument>("save_diagram_mermaid", { projectPath, documentId, mermaid }),
  addChatNote: (projectPath, text, tags) => invoke<ChatNote>("add_chat_note", { projectPath, text, tags }),
  listChatNotes: (projectPath) => invoke<ChatNote[]>("list_chat_notes", { projectPath }),
  addDecision: (projectPath, text, reason) => invoke<Decision>("add_decision", { projectPath, text, reason }),
  listDecisions: (projectPath) => invoke<Decision[]>("list_decisions", { projectPath }),
  listReferences: (projectPath) => invoke<ProjectReference[]>("list_references", { projectPath }),
  addReferences: (projectPath, references) => invoke<ProjectReference[]>("add_references", { projectPath, references }),
  processRepositoryReference: (projectPath, input) =>
    invoke<ProjectReference>("process_repository_reference", { projectPath, input: { input } }),
  updateReference: (projectPath, referenceId, patch) =>
    invoke<ProjectReference>("update_reference", { projectPath, referenceId, patch }),
  removeReference: (projectPath, referenceId) => invoke<void>("remove_reference", { projectPath, referenceId }),
  listReviewSessions: (projectPath) => invoke<ReviewSession[]>("list_review_sessions", { projectPath }),
  loadReviewSession: (projectPath, sessionId) => invoke<ReviewSession>("load_review_session", { projectPath, sessionId }),
  createScrumReviewSession: (projectPath, input) =>
    invoke<ReviewSession>("create_scrum_review_session", { projectPath, input }),
  listAgentCards: (projectPath) => invoke<AgentCard[]>("list_agent_cards", { projectPath }),
  retrieveMemoryContext: (args) =>
    invoke<RetrievedMemoryChunk[]>("retrieve_memory_context", {
      projectPath: args.projectPath,
      activeDocumentId: args.activeDocumentId,
      currentDocumentMarkdown: args.currentDocumentMarkdown,
      focusLine: args.focusLine,
      agentType: args.agentType,
      limit: args.limit ?? 5,
    }),
  createAgentCards: (projectPath, sourceAgent, cards) =>
    invoke<AgentCard[]>("create_agent_cards", { projectPath, sourceAgent, cards }),
  updateAgentCard: (projectPath, cardId, patch) =>
    invoke<AgentCard>("update_agent_card", { projectPath, cardId, patch }),
};
