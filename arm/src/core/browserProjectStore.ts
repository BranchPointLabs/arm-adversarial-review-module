import { defaultDocumentMarkdown } from "./contextTemplate";
import {
  AgentCard,
  AgentCardStatus,
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

type BrowserProjectRecord = {
  project: Project;
  context: string;
  documents: ProjectDocument[];
  notes: ChatNote[];
  decisions: Decision[];
  references: ProjectReference[];
  cards: AgentCard[];
};

type BrowserDb = {
  projects: BrowserProjectRecord[];
};

const storageKey = "arm.browserProjectStore.v2";

export const browserProjectStore: ProjectStore = {
  runtime: "browser",
  async listProjects() {
    return readDb().projects.map((record) => record.project).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async createProject(name) {
    const trimmed = name.trim();
    if (trimmed.length < 2) throw new Error("Project name too short.");

    const db = readDb();
    const path = `browser-preview://${slugify(trimmed)}`;
    if (db.projects.some((record) => record.project.path === path)) {
      throw new Error("Project already exists in this browser preview.");
    }

    const now = new Date().toISOString();
    const project = {
      id: newId(),
      name: trimmed,
      path,
      createdAt: now,
      updatedAt: now,
    };
    db.projects.push({
      project,
      context: "",
      documents: [],
      notes: [],
      decisions: [],
      references: [],
      cards: [],
    });
    writeDb(db);
    return project;
  },
  async loadCurrentContext(projectPath) {
    return getRecord(projectPath).context;
  },
  async saveCurrentContext(projectPath, markdown) {
    const db = readDb();
    const record = findRecord(db, projectPath);
    const now = new Date().toISOString();
    record.context = ensureTrailingNewline(markdown);
    record.project.updatedAt = now;
    writeDb(db);
  },
  async listDocuments(projectPath) {
    const db = readDb();
    const record = findRecord(db, projectPath);
    return [...record.documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async createDocument(projectPath, name, type) {
    const trimmed = name.trim();
    if (trimmed.length < 2) throw new Error("Document name too short.");
    assertDocumentType(type);

    const db = readDb();
    const record = findRecord(db, projectPath);
    const document = newDocument(record.project.id, trimmed, type);
    record.documents.unshift(document);
    record.context = document.markdown;
    record.project.updatedAt = document.updatedAt;
    writeDb(db);
    return document;
  },
  async loadDocument(projectPath, documentId) {
    const db = readDb();
    const record = findRecord(db, projectPath);
    const document = record.documents.find((item) => item.id === documentId);
    if (!document) throw new Error("Document not found.");
    return document;
  },
  async saveDocument(projectPath, documentId, markdown) {
    const db = readDb();
    const record = findRecord(db, projectPath);
    const document = record.documents.find((item) => item.id === documentId);
    if (!document) throw new Error("Document not found.");
    document.markdown = ensureTrailingNewline(markdown);
    document.updatedAt = new Date().toISOString();
    record.context = document.markdown;
    record.project.updatedAt = document.updatedAt;
    writeDb(db);
  },
  async addChatNote(projectPath, text, tags) {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Chat note cannot be empty.");

    const db = readDb();
    const record = findRecord(db, projectPath);
    const now = new Date().toISOString();
    const note = {
      id: newId(),
      projectId: record.project.id,
      text: trimmed,
      tags,
      createdAt: now,
    };
    record.notes.unshift(note);
    record.project.updatedAt = now;
    writeDb(db);
    return note;
  },
  async listChatNotes(projectPath) {
    return [...getRecord(projectPath).notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async addDecision(projectPath, text, reason) {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Decision cannot be empty.");

    const db = readDb();
    const record = findRecord(db, projectPath);
    const now = new Date().toISOString();
    const decision = {
      id: newId(),
      projectId: record.project.id,
      text: trimmed,
      reason,
      createdAt: now,
    };
    record.decisions.unshift(decision);
    record.project.updatedAt = now;
    writeDb(db);
    return decision;
  },
  async listDecisions(projectPath) {
    return [...getRecord(projectPath).decisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async listReferences(projectPath) {
    return [...getRecord(projectPath).references].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async addReferences(projectPath, references) {
    const valid = references.filter((item) => item.fileName.trim());
    if (valid.length === 0) return [];

    const db = readDb();
    const record = findRecord(db, projectPath);
    const now = new Date().toISOString();
    const created = valid.map((item) => ({
      id: newId(),
      projectId: record.project.id,
      fileName: item.fileName.trim(),
      filePath: item.filePath,
      extractedText: item.extractedText,
      summary: item.summary,
      isSelected: true,
      createdAt: now,
    }));
    record.references = [...created, ...record.references];
    record.project.updatedAt = now;
    writeDb(db);
    return created;
  },
  async updateReference(projectPath, referenceId, patch) {
    const db = readDb();
    const record = findRecord(db, projectPath);
    const reference = record.references.find((item) => item.id === referenceId);
    if (!reference) throw new Error("Reference not found.");
    Object.assign(reference, patch);
    record.project.updatedAt = new Date().toISOString();
    writeDb(db);
    return reference;
  },
  async removeReference(projectPath, referenceId) {
    const db = readDb();
    const record = findRecord(db, projectPath);
    record.references = record.references.filter((item) => item.id !== referenceId);
    record.project.updatedAt = new Date().toISOString();
    writeDb(db);
  },
  async listAgentCards(projectPath) {
    return [...getRecord(projectPath).cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async createAgentCards(projectPath, sourceAgent, cards) {
    if (cards.length === 0) return [];
    const db = readDb();
    const record = findRecord(db, projectPath);
    const now = new Date().toISOString();
    const runId = newId();
    const created = cards.map((item) => ({
      id: newId(),
      projectId: record.project.id,
      runId,
      type: item.type,
      status: "pending" as AgentCardStatus,
      title: item.title,
      body: item.body,
      proposedUpdate: item.proposedUpdate,
      targetSection: item.targetSection,
      sourceAgent: item.sourceAgent || sourceAgent,
      createdAt: now,
    }));
    record.cards = [...created, ...record.cards].slice(0, 30);
    record.project.updatedAt = now;
    writeDb(db);
    return created;
  },
  async updateAgentCard(projectPath, cardId, patch) {
    const db = readDb();
    const record = findRecord(db, projectPath);
    const card = record.cards.find((item) => item.id === cardId);
    if (!card) throw new Error("Card not found.");
    Object.assign(card, patch);
    record.project.updatedAt = new Date().toISOString();
    writeDb(db);
    return card;
  },
};

function readDb(): BrowserDb {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return { projects: [] };
  try {
    const parsed = JSON.parse(raw) as BrowserDb;
    return { projects: Array.isArray(parsed.projects) ? parsed.projects : [] };
  } catch {
    return { projects: [] };
  }
}

function writeDb(db: BrowserDb) {
  window.localStorage.setItem(storageKey, JSON.stringify(db));
}

function getRecord(projectPath: string) {
  return findRecord(readDb(), projectPath);
}

function findRecord(db: BrowserDb, projectPath: string) {
  const record = db.projects.find((item) => item.project.path === projectPath);
  if (!record) throw new Error("Project not found.");
  return record;
}

function newDocument(projectId: string, name: string, type: DocumentType): ProjectDocument {
  const now = new Date().toISOString();
  return {
    id: newId(),
    projectId,
    name,
    type,
    markdown: defaultDocumentMarkdown(name, type),
    createdAt: now,
    updatedAt: now,
  };
}

function assertDocumentType(type: string): asserts type is DocumentType {
  if (type !== "IDEA" && type !== "PRD") throw new Error("Document type must be IDEA or PRD.");
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureTrailingNewline(value: string) {
  return `${value.replace(/[\r\n]+$/g, "")}\n`;
}
