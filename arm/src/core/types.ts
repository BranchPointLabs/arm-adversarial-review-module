export type Project = {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatNote = {
  id: string;
  projectId: string;
  text: string;
  tags: string[] | null;
  createdAt: string;
};

export type Decision = {
  id: string;
  projectId: string;
  text: string;
  reason: string | null;
  createdAt: string;
};

export type DocumentType = "IDEA" | "PRD" | "PLAN" | "diagram";

export type DiagramEntity = {
  id: string;
  name: string;
  responsibility: string;
  collaborators: string[];
};

export type ProjectReference = {
  id: string;
  projectId: string;
  type: "file" | "repository";
  fileName: string;
  filePath: string | null;
  extractedText: string | null;
  summary: string | null;
  sourceUrl: string | null;
  isSelected: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RetrievedMemoryChunk = {
  chunkId: string;
  documentTitle: string;
  sectionTitle: string | null;
  text: string;
  similarity: number;
  sourceKind: "document" | "reference" | "decision";
};

export type AgentCardType =
  | "info"
  | "open_question"
  | "action"
  | "warning";

export type AgentCardStatus = "pending" | "accepted" | "rejected" | "edited" | "resolved";

export type AgentCard = {
  id: string;
  projectId: string;
  runId: string;
  type: AgentCardType;
  status: AgentCardStatus;
  title: string;
  body: string;
  proposedUpdate: string | null;
  targetSection: string | null;
  sourceAgent: string;
  sourceDocumentTitle: string | null;
  sourceSectionTitle: string | null;
  createdAt: string;
};

export type NewReferenceInput = {
  type?: "file" | "repository";
  fileName: string;
  filePath: string | null;
  extractedText: string | null;
  summary: string | null;
  sourceUrl?: string | null;
};

export type NewAgentCardInput = {
  type: AgentCardType;
  title: string;
  body: string;
  proposedUpdate: string | null;
  targetSection: string | null;
  sourceAgent: string;
  sourceDocumentTitle?: string | null;
  sourceSectionTitle?: string | null;
};

export type ProjectDocument = {
  id: string;
  projectId: string;
  name: string;
  type: DocumentType;
  markdown: string;
  entities: DiagramEntity[];
  mermaid: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectStore = {
  runtime: "desktop" | "browser";
  listProjects(): Promise<Project[]>;
  createProject(name: string): Promise<Project>;
  listDocuments(projectPath: string): Promise<ProjectDocument[]>;
  createDocument(projectPath: string, name: string, type: DocumentType): Promise<ProjectDocument>;
  loadDocument(projectPath: string, documentId: string): Promise<ProjectDocument>;
  saveDocument(projectPath: string, documentId: string, markdown: string): Promise<void>;
  deleteDocument(projectPath: string, documentId: string): Promise<void>;
  saveDiagramDocument(projectPath: string, documentId: string, entities: DiagramEntity[]): Promise<ProjectDocument>;
  saveDiagramMermaid(projectPath: string, documentId: string, mermaid: string): Promise<ProjectDocument>;
  addChatNote(projectPath: string, text: string, tags: string[] | null): Promise<ChatNote>;
  listChatNotes(projectPath: string): Promise<ChatNote[]>;
  addDecision(projectPath: string, text: string, reason: string | null): Promise<Decision>;
  listDecisions(projectPath: string): Promise<Decision[]>;
  listReferences(projectPath: string): Promise<ProjectReference[]>;
  addReferences(projectPath: string, references: NewReferenceInput[]): Promise<ProjectReference[]>;
  processRepositoryReference(projectPath: string, input: string): Promise<ProjectReference>;
  updateReference(
    projectPath: string,
    referenceId: string,
    patch: Partial<Pick<ProjectReference, "summary" | "extractedText" | "isSelected">>,
  ): Promise<ProjectReference>;
  removeReference(projectPath: string, referenceId: string): Promise<void>;
  listAgentCards(projectPath: string): Promise<AgentCard[]>;
  retrieveMemoryContext(args: {
    projectPath: string;
    activeDocumentId: string | null;
    currentDocumentMarkdown: string;
    focusLine: string;
    agentType: "product" | "technical" | "everything";
    limit?: number;
  }): Promise<RetrievedMemoryChunk[]>;
  createAgentCards(projectPath: string, sourceAgent: string, cards: NewAgentCardInput[]): Promise<AgentCard[]>;
  updateAgentCard(
    projectPath: string,
    cardId: string,
    patch: Partial<Pick<AgentCard, "status" | "title" | "body" | "proposedUpdate" | "targetSection">>,
  ): Promise<AgentCard>;
};
