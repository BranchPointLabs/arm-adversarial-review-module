import React from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { buildContextDraft, buildReviewCards, ReviewMode, summarizeReferenceText } from "../../core/armEngine";
import { generateReviewCardsWithLlm } from "../../core/llmReview";
import {
  AgentCard,
  ChatNote,
  Decision,
  DocumentType,
  NewAgentCardInput,
  ProjectDocument,
  ProjectReference,
  projectStore,
} from "../../core/projectStore";
import Modal from "../shared/Modal";

type ViewKey = "context" | "notes" | "decisions" | "references" | "review" | "document";
type SidebarView = "activity" | "cards" | "notes" | "decisions";
type ComposerMode = "chat" | "note" | "decision" | "review";

const modeLabels: Record<ReviewMode, string> = {
  chat: "chat",
  product: "product review",
  technical: "technical review",
  everything: "everything",
};

const acceptedReferenceTypes = [
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".csv",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".rs",
  ".go",
  ".py",
  ".java",
  ".cs",
  ".html",
  ".css",
];

export default function ProjectWorkspace() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const projectPath = params.projectPath ? decodeURIComponent(params.projectPath) : "";
  const projectName = projectPath.split(/[\\/]/).filter(Boolean).pop()?.replace(/^browser-preview:\/\//, "") || "Project";

  const [navCollapsed, setNavCollapsed] = React.useState(false);
  const [documents, setDocuments] = React.useState<ProjectDocument[]>([]);
  const [notes, setNotes] = React.useState<ChatNote[]>([]);
  const [decisions, setDecisions] = React.useState<Decision[]>([]);
  const [references, setReferences] = React.useState<ProjectReference[]>([]);
  const [cards, setCards] = React.useState<AgentCard[]>([]);
  const [activeDocument, setActiveDocument] = React.useState<ProjectDocument | null>(null);
  const [documentMarkdown, setDocumentMarkdown] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [submitBusy, setSubmitBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [errorModalMessage, setErrorModalMessage] = React.useState<string | null>(null);

  const [prompt, setPrompt] = React.useState("");
  const [reviewMode, setReviewMode] = React.useState<ReviewMode>("product");
  const [sidebarView, setSidebarView] = React.useState<SidebarView>("activity");
  const [composerMode, setComposerMode] = React.useState<ComposerMode>("chat");

  const [addDocumentOpen, setAddDocumentOpen] = React.useState(false);
  const [newDocumentName, setNewDocumentName] = React.useState("");
  const [newDocumentType, setNewDocumentType] = React.useState<DocumentType>("IDEA");
  const [newDocumentStatus, setNewDocumentStatus] = React.useState<string | null>(null);

  const [decisionOpen, setDecisionOpen] = React.useState(false);
  const [decisionText, setDecisionText] = React.useState("");
  const [decisionReason, setDecisionReason] = React.useState("");
  const [decisionStatus, setDecisionStatus] = React.useState<string | null>(null);

  const [editCard, setEditCard] = React.useState<AgentCard | null>(null);
  const [editCardTitle, setEditCardTitle] = React.useState("");
  const [editCardBody, setEditCardBody] = React.useState("");
  const [editCardUpdate, setEditCardUpdate] = React.useState("");

  const [draftOpen, setDraftOpen] = React.useState(false);
  const [draftMarkdown, setDraftMarkdown] = React.useState("");

  const filesInputRef = React.useRef<HTMLInputElement | null>(null);
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);

  const route = parseRoute(location.pathname);
  const currentView = route.view;
  const routeDocumentId = route.documentId;
  const activeContextMarkdown = activeDocument ? documentMarkdown : "";
  const stickyNotes = notes.filter(isStickyNote);
  const chatMessages = notes.filter((note) => !isStickyNote(note));
  const sidebarItems = buildSidebarItems(sidebarView, chatMessages, stickyNotes, decisions, cards);

  React.useEffect(() => {
    if (!projectPath) return;
    void refreshAll();
  }, [projectPath]);

  React.useEffect(() => {
    if (!projectPath) return;
    const nextDocument =
      documents.find((item) => item.id === routeDocumentId) ||
      documents.find((item) => item.id === activeDocument?.id) ||
      documents[0] ||
      null;
    setActiveDocument(nextDocument);
    setDocumentMarkdown(nextDocument?.markdown || "");
  }, [documents, routeDocumentId, projectPath]);

  if (!projectPath) {
    return <Navigate to="/" replace />;
  }

  async function refreshAll() {
    setBusy(true);
    try {
      const [nextDocuments, nextNotes, nextDecisions, nextReferences, nextCards] = await Promise.all([
        projectStore.listDocuments(projectPath),
        projectStore.listChatNotes(projectPath),
        projectStore.listDecisions(projectPath),
        projectStore.listReferences(projectPath),
        projectStore.listAgentCards(projectPath),
      ]);

      setDocuments(nextDocuments);
      setNotes(nextNotes);
      setDecisions(nextDecisions);
      setReferences(nextReferences);
      setCards(nextCards);
      setStatus(null);
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Failed to load project.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDocumentNow() {
    if (!activeDocument) return;
    setBusy(true);
    try {
      await projectStore.saveDocument(projectPath, activeDocument.id, documentMarkdown);
      setStatus("Document saved.");
      await refreshAll();
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createDocument() {
    const trimmed = newDocumentName.trim();
    if (trimmed.length < 2) {
      setNewDocumentStatus("Document name too short.");
      return;
    }

    setBusy(true);
    try {
      const document = await projectStore.createDocument(projectPath, trimmed, newDocumentType);
      setAddDocumentOpen(false);
      setNewDocumentName("");
      setNewDocumentType("IDEA");
      setNewDocumentStatus(null);
      await refreshAll();
      navigate(`/p/${encodeURIComponent(projectPath)}/documents/${document.id}`);
    } catch (error: any) {
      setNewDocumentStatus(typeof error === "string" ? error : error?.message || "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addDecision() {
    const trimmed = decisionText.trim();
    if (!trimmed) {
      setDecisionStatus("Decision cannot be empty.");
      return;
    }

    setBusy(true);
    try {
      await projectStore.addDecision(projectPath, trimmed, decisionReason.trim() || null);
      setDecisionOpen(false);
      setDecisionText("");
      setDecisionReason("");
      setDecisionStatus(null);
      await refreshAll();
      setStatus("Decision captured.");
    } catch (error: any) {
      setDecisionStatus(typeof error === "string" ? error : error?.message || "Decision failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPrompt() {
    const text = prompt.trim();
    if (!text) return;

    setSubmitBusy(true);
    try {
      if (composerMode === "chat") {
        await projectStore.addChatNote(projectPath, text, ["chat"]);
        setStatus("Chat saved.");
      } else if (composerMode === "note") {
        await projectStore.addChatNote(projectPath, text, ["note"]);
        setStatus("Note saved.");
      } else if (composerMode === "decision") {
        await projectStore.addDecision(projectPath, text, decisionReason.trim() || null);
        setDecisionReason("");
        setStatus("Decision captured.");
      } else {
        const cardsToCreate = await buildCardsForPrompt(text);
        await projectStore.createAgentCards(projectPath, labelForMode(reviewMode), cardsToCreate);
        setStatus(cardsToCreate.length > 0 ? "Review cards added." : "No cards generated for that prompt.");
        setSidebarView("cards");
      }

      setPrompt("");
      await refreshAll();
    } catch (error: any) {
      setErrorModalMessage(typeof error === "string" ? error : error?.message || "Submit failed.");
    } finally {
      setSubmitBusy(false);
    }
  }

  async function buildCardsForPrompt(text: string) {
    if (!activeDocument) {
      throw new Error("Create and select a document before running a review.");
    }

    const heuristicFallback = () =>
      buildReviewCards({
        prompt: text,
        mode: composerMode === "review" ? reviewMode : "chat",
        activeDocument,
        currentContext: activeContextMarkdown,
        notes,
        decisions,
        references,
      });

    try {
      if (reviewMode === "product") {
        return await generateReviewCardsWithLlm({
          prompt: text,
          mode: "product",
          activeDocument,
          currentContext: activeContextMarkdown,
          notes,
          decisions,
          references,
        });
      }

      if (reviewMode === "technical") {
        return await generateReviewCardsWithLlm({
          prompt: text,
          mode: "technical",
          activeDocument,
          currentContext: activeContextMarkdown,
          notes,
          decisions,
          references,
        });
      }

      const outcomes = await Promise.allSettled([
        generateReviewCardsWithLlm({
          prompt: text,
          mode: "product",
          activeDocument,
          currentContext: activeContextMarkdown,
          notes,
          decisions,
          references,
        }),
        generateReviewCardsWithLlm({
          prompt: text,
          mode: "technical",
          activeDocument,
          currentContext: activeContextMarkdown,
          notes,
          decisions,
          references,
        }),
      ]);

      const merged = outcomes
        .filter((item): item is PromiseFulfilledResult<any> => item.status === "fulfilled")
        .flatMap((item) => item.value);
      if (merged.length > 0) {
        return dedupeNewCards(merged).slice(0, 5);
      }

      const rejected = outcomes.find((item): item is PromiseRejectedResult => item.status === "rejected");
      throw rejected?.reason || new Error("LLM review failed.");
    } catch (error: any) {
      setStatus(
        `${typeof error === "string" ? error : error?.message || "LLM review failed."} Falling back to local review.`,
      );
      return heuristicFallback();
    }
  }

  async function setCardStatus(card: AgentCard, nextStatus: AgentCard["status"]) {
    setBusy(true);
    try {
      await projectStore.updateAgentCard(projectPath, card.id, { status: nextStatus });
      await refreshAll();
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Card update failed.");
    } finally {
      setBusy(false);
    }
  }

  function openEditCard(card: AgentCard) {
    setEditCard(card);
    setEditCardTitle(card.title);
    setEditCardBody(card.body);
    setEditCardUpdate(card.proposedUpdate || "");
  }

  async function saveEditedCard() {
    if (!editCard) return;
    setBusy(true);
    try {
      await projectStore.updateAgentCard(projectPath, editCard.id, {
        status: "edited",
        title: editCardTitle.trim() || editCard.title,
        body: editCardBody.trim() || editCard.body,
        proposedUpdate: editCardUpdate.trim() || null,
      });
      setEditCard(null);
      await refreshAll();
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Edit failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePickedFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const referenceInputs = await Promise.all(
      Array.from(fileList)
        .filter((file) => isReferenceFile(file.name))
        .map(async (file) => {
          const extractedText = await safeReadText(file);
          return {
            fileName: file.name,
            filePath: "webkitRelativePath" in file && file.webkitRelativePath ? file.webkitRelativePath : file.name,
            extractedText,
            summary: extractedText ? summarizeReferenceText(extractedText) : null,
          };
        }),
    );

    if (referenceInputs.length === 0) {
      setStatus("No supported text references were selected.");
      return;
    }

    setBusy(true);
    try {
      await projectStore.addReferences(projectPath, referenceInputs);
      setStatus("References added.");
      await refreshAll();
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Failed to add references.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleReference(reference: ProjectReference) {
    setBusy(true);
    try {
      await projectStore.updateReference(projectPath, reference.id, { isSelected: !reference.isSelected });
      await refreshAll();
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Reference update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function summarizeReference(reference: ProjectReference) {
    const summary = summarizeReferenceText(reference.extractedText || "");
    setBusy(true);
    try {
      await projectStore.updateReference(projectPath, reference.id, { summary });
      await refreshAll();
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Summary failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeReference(reference: ProjectReference) {
    setBusy(true);
    try {
      await projectStore.removeReference(projectPath, reference.id);
      await refreshAll();
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Remove failed.");
    } finally {
      setBusy(false);
    }
  }

  function openContextDraft() {
    if (!activeDocument) {
      setErrorModalMessage("Create and select a document before updating context.");
      return;
    }
    const draft = buildContextDraft({
      projectName,
      currentContext: activeContextMarkdown,
      decisions,
      cards,
      references,
    });
    setDraftMarkdown(draft);
    setDraftOpen(true);
  }

  async function applyContextDraft() {
    if (!activeDocument) return;
    setBusy(true);
    try {
      await projectStore.saveDocument(projectPath, activeDocument.id, draftMarkdown);
      setDocumentMarkdown(draftMarkdown);
      setDraftOpen(false);
      setStatus("Current context updated.");
      await refreshAll();
      navigate(`/p/${encodeURIComponent(projectPath)}/context`);
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Update context failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={"workspace armWorkspace" + (navCollapsed ? " navCollapsed" : "")}>
      <aside className="navPane workspaceSidebar" aria-label="Project navigation">
        <div className="projectLine">
          <button
            type="button"
            className="iconButton"
            aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setNavCollapsed((value) => !value)}
          >
            {navCollapsed ? ">" : "<"}
          </button>
          {!navCollapsed ? <div className="projectNameLine">{projectName}</div> : null}
        </div>

        {!navCollapsed ? (
          <>
            <div className="workspaceNavBlock">
              <div className="workspaceNavLabel">Project</div>
              <NavButton
                active={currentView === "context"}
                label="Context Document"
                onClick={() => navigate(`/p/${encodeURIComponent(projectPath)}/context`)}
              />
              <NavButton
                active={currentView === "references"}
                label={`References (${references.length})`}
                onClick={() => navigate(`/p/${encodeURIComponent(projectPath)}/references`)}
              />
            </div>

            <div className="workspaceNavBlock workspaceNavFill">
              <div className="workspaceNavLabel">Documents</div>
              <div className="documentList" aria-label="Documents">
                {documents.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    className={"documentNavItem" + (routeDocumentId === document.id ? " active" : "")}
                    onClick={() => navigate(`/p/${encodeURIComponent(projectPath)}/documents/${document.id}`)}
                  >
                    <span className="documentType">{document.type}</span>
                    <span className="documentName">{document.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="documentNavFooter">
              <button type="button" className="addDocumentButton" onClick={() => setAddDocumentOpen(true)}>
                Add Document
              </button>
            </div>
          </>
        ) : null}
      </aside>

      <section className="focusPane workspaceFocus">{renderCenterPane()}</section>

      <aside className="inputPane reviewRail unifiedSidebar" aria-label="Unified activity sidebar">
        <div className="railHeader">
          <div>
            <div className="inputPaneTitle">Activity</div>
            <div className="railMeta">
              {cards.filter((card) => card.status === "accepted" || card.status === "edited").length} accepted cards
            </div>
          </div>
          <button type="button" className="secondary" onClick={openContextDraft} disabled={busy}>
            Update Context
          </button>
        </div>
        <div className="segmentedControl sidebarFeatureBar">
          {(["activity", "cards", "notes", "decisions"] as SidebarView[]).map((view) => (
            <button
              key={view}
              type="button"
              className={"segmentedPill" + (sidebarView === view ? " active" : "")}
              onClick={() => setSidebarView(view)}
            >
              {sidebarFeatureLabel(view)}
            </button>
          ))}
        </div>
        <div className="inputCardList unifiedStream">
          {sidebarItems.map((item) => (
            <SidebarItemView
              key={item.id}
              item={item}
              onAccept={(card) => void setCardStatus(card, "accepted")}
              onReject={(card) => void setCardStatus(card, "rejected")}
              onEdit={openEditCard}
            />
          ))}
          {sidebarItems.length === 0 ? <div className="muted">No activity here yet.</div> : null}
        </div>
        <div className="sidebarComposer">
          <div className="segmentedControl sidebarActionBar">
            {(["chat", "note", "decision", "review"] as ComposerMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={"segmentedPill" + (composerMode === mode ? " active" : "")}
                onClick={() => setComposerMode(mode)}
              >
                {composerModeLabel(mode)}
              </button>
            ))}
          </div>
          {composerMode === "review" ? (
            <div className="segmentedControl sidebarReviewBar">
              {(["product", "technical", "everything"] as ReviewMode[]).filter((mode) => mode !== "chat").map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={"segmentedPill" + (reviewMode === mode ? " active" : "")}
                  onClick={() => setReviewMode(mode)}
                >
                  {modeLabels[mode]}
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            className="sidebarComposerInput"
            value={prompt}
            placeholder={composerPlaceholder(composerMode, reviewMode)}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !submitBusy) void submitPrompt();
            }}
          />
          {composerMode === "decision" ? (
            <input
              className="textInput"
              value={decisionReason}
              placeholder="Reason (optional)"
              onChange={(event) => setDecisionReason(event.target.value)}
            />
          ) : null}
          <div className="sidebarComposerFooter">
            <div className="railMeta">`Ctrl/Cmd + Enter` submits</div>
            <button
              type="button"
              className="primary submitButton"
              onClick={() => void submitPrompt()}
              disabled={busy || submitBusy || !prompt.trim()}
            >
              {submitBusy ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  <span>Submitting</span>
                </>
              ) : (
                "Submit"
              )}
            </button>
          </div>
        </div>
      </aside>

      <input
        ref={filesInputRef}
        type="file"
        accept={acceptedReferenceTypes.join(",")}
        multiple
        hidden
        onChange={(event) => void handlePickedFiles(event.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        hidden
        multiple
        {...({ webkitdirectory: "true", directory: "true" } as any)}
        onChange={(event) => void handlePickedFiles(event.target.files)}
      />

      {addDocumentOpen ? (
        <Modal
          title="Add Document"
          onClose={() => setAddDocumentOpen(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setAddDocumentOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={createDocument} disabled={busy}>
                Add
              </button>
            </>
          }
        >
          <div className="stack">
            <input
              autoFocus
              className="textInput"
              value={newDocumentName}
              placeholder="Document name"
              onChange={(event) => setNewDocumentName(event.target.value)}
            />
            <select
              className="selectInput"
              value={newDocumentType}
              onChange={(event) => setNewDocumentType(event.target.value as DocumentType)}
            >
              <option value="IDEA">IDEA</option>
              <option value="PRD">PRD</option>
            </select>
            {newDocumentStatus ? <div className="status">{newDocumentStatus}</div> : null}
          </div>
        </Modal>
      ) : null}

      {decisionOpen ? (
        <Modal
          title="Add Decision"
          onClose={() => setDecisionOpen(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setDecisionOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={addDecision} disabled={busy}>
                Save Decision
              </button>
            </>
          }
        >
          <div className="stack">
            <textarea
              className="miniEditor"
              value={decisionText}
              placeholder="Decision"
              onChange={(event) => setDecisionText(event.target.value)}
            />
            <textarea
              className="miniEditor"
              value={decisionReason}
              placeholder="Reason (optional)"
              onChange={(event) => setDecisionReason(event.target.value)}
            />
            {decisionStatus ? <div className="status">{decisionStatus}</div> : null}
          </div>
        </Modal>
      ) : null}

      {editCard ? (
        <Modal
          title="Edit Card"
          onClose={() => setEditCard(null)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setEditCard(null)}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={() => void saveEditedCard()} disabled={busy}>
                Save
              </button>
            </>
          }
        >
          <div className="stack">
            <input className="textInput" value={editCardTitle} onChange={(event) => setEditCardTitle(event.target.value)} />
            <textarea className="miniEditor" value={editCardBody} onChange={(event) => setEditCardBody(event.target.value)} />
            <textarea
              className="miniEditor"
              value={editCardUpdate}
              placeholder="Proposed update"
              onChange={(event) => setEditCardUpdate(event.target.value)}
            />
          </div>
        </Modal>
      ) : null}

      {draftOpen ? (
        <Modal
          title="Update Context"
          onClose={() => setDraftOpen(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setDraftOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={() => void applyContextDraft()} disabled={busy}>
                Replace Current Context
              </button>
            </>
          }
        >
          <div className="stack">
            <textarea className="editor draftEditor" value={draftMarkdown} onChange={(event) => setDraftMarkdown(event.target.value)} />
          </div>
        </Modal>
      ) : null}

      {errorModalMessage ? (
        <Modal
          title="Review Error"
          onClose={() => setErrorModalMessage(null)}
          footer={
            <button type="button" className="primary" onClick={() => setErrorModalMessage(null)}>
              Close
            </button>
          }
        >
          <div className="surfaceCopy">{errorModalMessage}</div>
        </Modal>
      ) : null}
    </div>
  );

  function renderCenterPane() {
    if (currentView === "notes") {
      return (
        <FocusFrame
          title="Chat Notes"
          description="Messy thinking lives here. Notes do not become project truth until they are turned into decisions or accepted cards."
          actions={<button type="button" className="secondary" onClick={() => setReviewMode("chat")}>Use chat mode</button>}
        >
          <div className="scrollPanel stack">
            {notes.map((note) => (
              <div key={note.id} className="feedItem">
                <div className="feedMeta">{formatTime(note.createdAt)}</div>
                <div>{note.text}</div>
              </div>
            ))}
            {notes.length === 0 ? <div className="muted">No chat notes yet.</div> : null}
          </div>
        </FocusFrame>
      );
    }

    if (currentView === "decisions") {
      return (
        <FocusFrame
          title="Decisions"
          description="Decisions are explicit project truth. They feed the next context rewrite."
          actions={<button type="button" className="primary" onClick={() => setDecisionOpen(true)}>Add Decision</button>}
        >
          <div className="scrollPanel stack">
            {decisions.map((decision) => (
              <div key={decision.id} className="feedItem">
                <div className="feedMeta">{formatTime(decision.createdAt)}</div>
                <div className="reviewCardTitle">{decision.text}</div>
                {decision.reason ? <div className="surfaceCopy">{decision.reason}</div> : null}
              </div>
            ))}
            {decisions.length === 0 ? <div className="muted">No decisions yet.</div> : null}
          </div>
        </FocusFrame>
      );
    }

    if (currentView === "references") {
      return (
        <FocusFrame
          title="References"
          description="Attach files or folders, choose what stays in play, and summarize only the parts that should influence the living context."
          actions={
            <div className="row">
              <button type="button" className="secondary" onClick={() => filesInputRef.current?.click()}>
                Add Files
              </button>
              <button type="button" className="secondary" onClick={() => folderInputRef.current?.click()}>
                Add Folder
              </button>
            </div>
          }
        >
          <ReferenceDropZone
            onFiles={(files) => void handlePickedFiles(files)}
            onPickFiles={() => filesInputRef.current?.click()}
          />
          <div className="scrollPanel stack">
            {references.map((reference) => (
              <div key={reference.id} className="referenceCard">
                <div className="referenceHeader">
                  <div>
                    <div className="reviewCardTitle">{reference.fileName}</div>
                    <div className="feedMeta">{reference.filePath || "Uploaded reference"}</div>
                  </div>
                  <label className="referenceToggle">
                    <input type="checkbox" checked={reference.isSelected} onChange={() => void toggleReference(reference)} />
                    <span>Selected</span>
                  </label>
                </div>
                <div className="surfaceCopy">
                  {reference.summary || "No summary yet."}
                </div>
                <div className="referenceActions">
                  <button type="button" className="secondary" onClick={() => void summarizeReference(reference)}>
                    Generate Summary
                  </button>
                  <button type="button" className="secondary" onClick={() => void removeReference(reference)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {references.length === 0 ? <div className="muted">No references attached yet.</div> : null}
          </div>
        </FocusFrame>
      );
    }

    if (currentView === "review") {
      return (
        <FocusFrame
          title="Review Feed"
          description="Reviews generate small cards. Accept the useful ones, reject the noise, then use Update Context to rewrite the brief."
          actions={<button type="button" className="secondary" onClick={openContextDraft}>Update Context</button>}
        >
          <div className="reviewSummaryGrid">
            <SummaryTile label="Pending" value={String(cards.filter((card) => card.status === "pending").length)} />
            <SummaryTile label="Accepted" value={String(cards.filter((card) => card.status === "accepted" || card.status === "edited").length)} />
            <SummaryTile label="References" value={String(references.filter((item) => item.isSelected).length)} />
            <SummaryTile label="Decisions" value={String(decisions.length)} />
          </div>
        </FocusFrame>
      );
    }

    if (currentView === "document") {
      return (
        <FocusFrame
          title={activeDocument?.name || "Document"}
          description={activeDocument ? `${activeDocument.type} document` : "Select a document from the left column."}
          actions={
            <button type="button" className="primary" disabled={!activeDocument || busy} onClick={() => void saveDocumentNow()}>
              Save Document
            </button>
          }
        >
          <textarea
            className="documentEditor"
            value={documentMarkdown}
            onChange={(event) => setDocumentMarkdown(event.target.value)}
            disabled={!activeDocument}
            spellCheck={false}
          />
        </FocusFrame>
      );
    }

    return (
      <FocusFrame
        title={activeDocument?.name || "No context document yet"}
        description={
          activeDocument
            ? "The selected document is the context source of truth for review and update flows."
            : "This project has no context yet. Create a document to establish the working truth."
        }
        actions={
          <div className="row">
            <button type="button" className="secondary" onClick={() => setDecisionOpen(true)}>
              Add Decision
            </button>
            <button type="button" className="secondary" onClick={openContextDraft}>
              Update Context
            </button>
            <button type="button" className="primary" disabled={busy || !activeDocument} onClick={() => void saveDocumentNow()}>
              Save Document
            </button>
          </div>
        }
      >
        {activeDocument ? (
          <textarea
            className="documentEditor"
            value={documentMarkdown}
            onChange={(event) => setDocumentMarkdown(event.target.value)}
            spellCheck={false}
          />
        ) : (
          <div className="emptyContextState">
            <div className="surfaceTitle">No context document</div>
            <div className="surfaceCopy">
              Create a document first. That selected document becomes the source of truth for current queries.
            </div>
            <button type="button" className="primary" onClick={() => setAddDocumentOpen(true)}>
              Add Document
            </button>
          </div>
        )}
        {status ? <div className="workspaceStatus">{status}</div> : null}
      </FocusFrame>
    );
  }
}

function NavButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={"workspaceNavItem" + (props.active ? " active" : "")} onClick={props.onClick}>
      {props.label}
    </button>
  );
}

function FocusFrame(props: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="focusFrame">
      <div className="focusFrameHeader">
        <div>
          <div className="focusTitle">{props.title}</div>
          <div className="focusDescription">{props.description}</div>
        </div>
        {props.actions ? <div className="focusActions">{props.actions}</div> : null}
      </div>
      <div className="focusFrameBody">{props.children}</div>
    </div>
  );
}

function ReferenceDropZone(props: { onFiles: (files: FileList | null) => void; onPickFiles: () => void }) {
  const [dragging, setDragging] = React.useState(false);

  return (
    <div
      className={"referenceDropZone" + (dragging ? " active" : "")}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        props.onFiles(event.dataTransfer.files);
      }}
    >
      <div className="surfaceTitle">Drop text files here</div>
      <div className="surfaceCopy">Supports markdown, plain text, code, config, and other readable text files.</div>
      <button type="button" className="secondary" onClick={props.onPickFiles}>
        Pick Files
      </button>
    </div>
  );
}

function SummaryTile(props: { label: string; value: string }) {
  return (
    <div className="summaryTile">
      <div className="summaryValue">{props.value}</div>
      <div className="summaryLabel">{props.label}</div>
    </div>
  );
}

type SidebarItem =
  | { kind: "chat"; id: string; createdAt: string; text: string }
  | { kind: "note"; id: string; createdAt: string; text: string }
  | { kind: "decision"; id: string; createdAt: string; text: string; reason: string | null }
  | { kind: "card"; id: string; createdAt: string; card: AgentCard };

function buildSidebarItems(
  view: SidebarView,
  chatMessages: ChatNote[],
  stickyNotes: ChatNote[],
  decisions: Decision[],
  cards: AgentCard[],
): SidebarItem[] {
  const items: SidebarItem[] = [];

  if (view === "activity" || view === "cards") {
    items.push(...cards.map((card) => ({ kind: "card" as const, id: card.id, createdAt: card.createdAt, card })));
  }
  if (view === "activity") {
    items.push(
      ...chatMessages.map((note) => ({ kind: "chat" as const, id: note.id, createdAt: note.createdAt, text: note.text })),
      ...stickyNotes.map((note) => ({ kind: "note" as const, id: note.id, createdAt: note.createdAt, text: note.text })),
      ...decisions.map((decision) => ({
        kind: "decision" as const,
        id: decision.id,
        createdAt: decision.createdAt,
        text: decision.text,
        reason: decision.reason,
      })),
    );
  }
  if (view === "notes") {
    items.push(...stickyNotes.map((note) => ({ kind: "note" as const, id: note.id, createdAt: note.createdAt, text: note.text })));
  }
  if (view === "decisions") {
    items.push(
      ...decisions.map((decision) => ({
        kind: "decision" as const,
        id: decision.id,
        createdAt: decision.createdAt,
        text: decision.text,
        reason: decision.reason,
      })),
    );
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function SidebarItemView(props: {
  item: SidebarItem;
  onAccept: (card: AgentCard) => void;
  onReject: (card: AgentCard) => void;
  onEdit: (card: AgentCard) => void;
}) {
  const item = props.item;
  if (item.kind === "chat") {
    return (
      <div className="streamItem streamItem-chat">
        <div className="streamMeta">Chat · {formatTime(item.createdAt)}</div>
        <div>{item.text}</div>
      </div>
    );
  }

  if (item.kind === "note") {
    return (
      <div className="streamItem streamItem-note">
        <div className="streamMeta">Note · {formatTime(item.createdAt)}</div>
        <div>{item.text}</div>
      </div>
    );
  }

  if (item.kind === "decision") {
    return (
      <div className="streamItem streamItem-decision">
        <div className="streamMeta">Decision · {formatTime(item.createdAt)}</div>
        <div className="reviewCardTitle">{item.text}</div>
        {item.reason ? <div className="surfaceCopy">{item.reason}</div> : null}
      </div>
    );
  }

  const card = item.card;
  return (
    <div className={"reviewCard reviewCard-" + card.status}>
      <div className="reviewCardHeader">
        <span className="reviewCardType">{formatCardType(card.type)}</span>
        <span className="reviewCardStatus">{card.status}</span>
      </div>
      <div className="reviewCardTitle">{card.title}</div>
      <div className="reviewCardBody">{card.body}</div>
      {card.proposedUpdate ? <div className="reviewCardUpdate">{card.proposedUpdate}</div> : null}
      <div className="reviewCardActions">
        <button type="button" className="secondary" onClick={() => props.onAccept(card)}>
          Accept
        </button>
        <button type="button" className="secondary" onClick={() => props.onReject(card)}>
          Reject
        </button>
        <button type="button" className="secondary" onClick={() => props.onEdit(card)}>
          Edit
        </button>
      </div>
    </div>
  );
}

function parseRoute(pathname: string): { view: ViewKey; documentId: string | null } {
  const parts = pathname.split("/").filter(Boolean);
  const view = parts[2];
  if (view === "notes") return { view: "notes", documentId: null };
  if (view === "decisions") return { view: "decisions", documentId: null };
  if (view === "references") return { view: "references", documentId: null };
  if (view === "review") return { view: "review", documentId: null };
  if (view === "documents") return { view: "document", documentId: parts[3] || null };
  return { view: "context", documentId: null };
}

function labelForMode(mode: ReviewMode) {
  if (mode === "product") return "PM Agent";
  if (mode === "technical") return "Engineer Agent";
  if (mode === "everything") return "Critic Agent";
  return "Chat";
}

function formatCardType(value: string) {
  return value.replace(/_/g, " ");
}

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function isReferenceFile(name: string) {
  const lowered = name.toLowerCase();
  return acceptedReferenceTypes.some((suffix) => lowered.endsWith(suffix));
}

function dedupeNewCards(cards: NewAgentCardInput[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.type}|${card.title}|${card.targetSection || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sidebarFeatureLabel(view: SidebarView) {
  if (view === "activity") return "Activity";
  if (view === "cards") return "Cards";
  if (view === "notes") return "Notes";
  return "Decisions";
}

function composerModeLabel(mode: ComposerMode) {
  if (mode === "chat") return "Chat";
  if (mode === "note") return "Note";
  if (mode === "decision") return "Decision";
  return "Review";
}

function composerPlaceholder(mode: ComposerMode, reviewMode: ReviewMode) {
  if (mode === "chat") return "Capture a conversational thought...";
  if (mode === "note") return "Write a sticky note...";
  if (mode === "decision") return "State the decision...";
  if (reviewMode === "product") return "Ask the CPO reviewer to pressure-test this...";
  if (reviewMode === "technical") return "Ask the engineering reviewer to pressure-test this...";
  return "Run both reviewers on this prompt...";
}

function isStickyNote(note: ChatNote) {
  return Array.isArray(note.tags) && note.tags.includes("note");
}

async function safeReadText(file: File) {
  try {
    const text = await file.text();
    return text.slice(0, 16000);
  } catch {
    return null;
  }
}
