import { isTauriRuntimeAvailable, tauriProjectStore } from "./tauriProjectStore";

export type {
  AgentCard,
  AgentCardStatus,
  AgentCardType,
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
  ReviewDialogueTurn,
  ReviewSession,
  NewReviewSessionInput,
  RetrievedMemoryChunk,
} from "./types";

export { isTauriRuntimeAvailable } from "./tauriProjectStore";

export const projectStore = tauriProjectStore;
