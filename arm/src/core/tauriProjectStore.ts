import { invoke } from "@tauri-apps/api/core";
import {
  AgentCard,
  ChatNote,
  Decision,
  DocumentType,
  NewAgentCardInput,
  NewReferenceInput,
  Project,
  ProjectDocument,
  ProjectReference,
  ProjectStore,
} from "./types";

export function isTauriRuntimeAvailable() {
  const anyGlobal = globalThis as any;
  return typeof anyGlobal?.__TAURI__?.core?.invoke === "function";
}

export const tauriProjectStore: ProjectStore = {
  runtime: "desktop",
  listProjects: () => invoke<Project[]>("list_projects"),
  createProject: (name) => invoke<Project>("create_project", { name }),
  listDocuments: (projectPath) => invoke<ProjectDocument[]>("list_documents", { projectPath }),
  createDocument: (projectPath, name, type: DocumentType) =>
    invoke<ProjectDocument>("create_document", { projectPath, name, documentType: type }),
  loadDocument: (projectPath, documentId) => invoke<ProjectDocument>("load_document", { projectPath, documentId }),
  saveDocument: (projectPath, documentId, markdown) =>
    invoke<void>("save_document", { projectPath, documentId, markdown }),
  loadCurrentContext: (projectPath) => invoke<string>("load_current_context", { projectPath }),
  saveCurrentContext: (projectPath, markdown) => invoke<void>("save_current_context", { projectPath, markdown }),
  addChatNote: (projectPath, text, tags) => invoke<ChatNote>("add_chat_note", { projectPath, text, tags }),
  listChatNotes: (projectPath) => invoke<ChatNote[]>("list_chat_notes", { projectPath }),
  addDecision: (projectPath, text, reason) => invoke<Decision>("add_decision", { projectPath, text, reason }),
  listDecisions: (projectPath) => invoke<Decision[]>("list_decisions", { projectPath }),
  listReferences: (projectPath) => invoke<ProjectReference[]>("list_references", { projectPath }),
  addReferences: (projectPath, references) => invoke<ProjectReference[]>("add_references", { projectPath, references }),
  updateReference: (projectPath, referenceId, patch) =>
    invoke<ProjectReference>("update_reference", { projectPath, referenceId, patch }),
  removeReference: (projectPath, referenceId) => invoke<void>("remove_reference", { projectPath, referenceId }),
  listAgentCards: (projectPath) => invoke<AgentCard[]>("list_agent_cards", { projectPath }),
  createAgentCards: (projectPath, sourceAgent, cards) =>
    invoke<AgentCard[]>("create_agent_cards", { projectPath, sourceAgent, cards }),
  updateAgentCard: (projectPath, cardId, patch) =>
    invoke<AgentCard>("update_agent_card", { projectPath, cardId, patch }),
};
