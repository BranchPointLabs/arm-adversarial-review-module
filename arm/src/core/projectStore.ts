import { browserProjectStore } from "./browserProjectStore";
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
} from "./types";

export const projectStore = isTauriRuntimeAvailable() ? tauriProjectStore : browserProjectStore;
