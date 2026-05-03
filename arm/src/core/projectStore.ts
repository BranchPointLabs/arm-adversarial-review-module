import { isTauriRuntimeAvailable, tauriProjectStore } from "./tauriProjectStore";

export type {
  AgentCard,
  AgentCardStatus,
  AgentCardType,
  ChatNote,
  Decision,
  DocumentType,
  NewAgentCardInput,
  NewReferenceInput,
  Project,
  ProjectDocument,
  ProjectReference,
  ProjectStore,
  RetrievedMemoryChunk,
} from "./types";

export { isTauriRuntimeAvailable } from "./tauriProjectStore";

export const projectStore = tauriProjectStore;
