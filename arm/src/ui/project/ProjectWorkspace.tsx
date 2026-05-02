import React from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { buildContextDraft, buildReviewCards, summarizeReferenceText } from "../../core/armEngine";
import {
  ChatPersonaMode,
  generateChatCardsWithLlm,
  generateChatReplyWithLlm,
  generateDocumentUpdateWithLlm,
  generateReviewCardsWithLlm,
} from "../../core/llmReview";
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
type ChatMode = "chat" | "product" | "technical" | "everything";
type CardFilter = "info" | "open_question" | "warning" | "action";
type ResolveKind = "patch" | "decision" | "open_question";
type PlanMode = "focused" | "kill";
type PlanStage = "setup" | "interrogation";
type PlanQuestion = {
  id: string;
  question: string;
  why: string;
  impact: string;
  source: string;
  answer: string;
  skipped: boolean;
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
  const [chatMode, setChatMode] = React.useState<ChatMode>("chat");
  const [cardFilter, setCardFilter] = React.useState<CardFilter>("info");
  const [showAllCards, setShowAllCards] = React.useState(false);
  const [showDismissedCards, setShowDismissedCards] = React.useState(false);

  const [addDocumentOpen, setAddDocumentOpen] = React.useState(false);
  const [newDocumentName, setNewDocumentName] = React.useState("");
  const [newDocumentType, setNewDocumentType] = React.useState<DocumentType>("IDEA");
  const [newDocumentStatus, setNewDocumentStatus] = React.useState<string | null>(null);

  const [updateOpen, setUpdateOpen] = React.useState(false);
  const [updateText, setUpdateText] = React.useState("");
  const [updateKind, setUpdateKind] = React.useState<"note" | "decision">("note");
  const [updateStatus, setUpdateStatus] = React.useState<string | null>(null);

  const [resolveCard, setResolveCard] = React.useState<AgentCard | null>(null);
  const [resolveKind, setResolveKind] = React.useState<ResolveKind>("patch");
  const [resolveText, setResolveText] = React.useState("");
  const [resolveStatus, setResolveStatus] = React.useState<string | null>(null);

  const [draftOpen, setDraftOpen] = React.useState(false);
  const [draftMarkdown, setDraftMarkdown] = React.useState("");
  const [planOpen, setPlanOpen] = React.useState(false);
  const [planStage, setPlanStage] = React.useState<PlanStage>("setup");
  const [planSelectedDocIds, setPlanSelectedDocIds] = React.useState<string[]>([]);
  const [planContext, setPlanContext] = React.useState("");
  const [planMode, setPlanMode] = React.useState<PlanMode>("focused");
  const [planQuestions, setPlanQuestions] = React.useState<PlanQuestion[]>([]);
  const [planStatus, setPlanStatus] = React.useState<string | null>(null);

  const filesInputRef = React.useRef<HTMLInputElement | null>(null);
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);

  const route = parseRoute(location.pathname);
  const currentView = route.view;
  const routeDocumentId = route.documentId;
  const activeContextMarkdown = activeDocument ? documentMarkdown : "";
  const stickyNotes = notes.filter(isStickyNote);
  const sidebarItems = buildSidebarItems(cards, cardFilter, showAllCards, showDismissedCards);
  const sourceDocuments = documents.filter((document) => document.type !== "PLAN");
  const planDocuments = documents.filter((document) => document.type === "PLAN");

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

  async function copyDocumentNow() {
    if (!activeDocument) return;
    try {
      await navigator.clipboard.writeText(documentMarkdown);
      setStatus("Document copied.");
    } catch (error: any) {
      setErrorModalMessage(typeof error === "string" ? error : error?.message || "Copy failed.");
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

  async function applyUpdate() {
    const trimmed = updateText.trim();
    if (!trimmed) {
      setUpdateStatus("Update text cannot be empty.");
      return;
    }
    if (!activeDocument) {
      setUpdateStatus("Select a document before applying an update.");
      return;
    }

    setBusy(true);
    try {
      const nextMarkdown = await buildDocumentUpdate(trimmed, updateKind);
      await projectStore.saveDocument(projectPath, activeDocument.id, nextMarkdown);
      setDocumentMarkdown(nextMarkdown);
      if (updateKind === "note") {
        await projectStore.addChatNote(projectPath, trimmed, ["note"]);
      } else {
        await projectStore.addDecision(projectPath, trimmed, null);
      }
      setUpdateOpen(false);
      setUpdateText("");
      setUpdateKind("note");
      setUpdateStatus(null);
      await refreshAll();
      setStatus(updateKind === "decision" ? "Decision applied." : "Note applied.");
    } catch (error: any) {
      setUpdateStatus(typeof error === "string" ? error : error?.message || "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  function openPlanMode() {
    const initialIds = activeDocument ? [activeDocument.id] : sourceDocuments.slice(0, 1).map((document) => document.id);
    setPlanSelectedDocIds(initialIds);
    setPlanContext("");
    setPlanMode("focused");
    setPlanQuestions([]);
    setPlanStage("setup");
    setPlanStatus(null);
    setPlanOpen(true);
  }

  function rerunPlan(document: ProjectDocument) {
    setPlanSelectedDocIds(sourceDocuments.slice(0, 3).map((item) => item.id));
    setPlanContext(`Re-plan from existing plan: ${document.name}`);
    setPlanMode("focused");
    setPlanQuestions([]);
    setPlanStage("setup");
    setPlanStatus(null);
    setPlanOpen(true);
  }

  function togglePlanSource(documentId: string) {
    setPlanSelectedDocIds((current) =>
      current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId],
    );
  }

  function startPlanningInterrogation() {
    const selected = getSelectedPlanDocuments();
    if (selected.length === 0) {
      setPlanStatus("Select at least one source document.");
      return;
    }
    const questions = buildPlanQuestions(selected, getPlanningCards(), planContext, planMode);
    setPlanQuestions(questions);
    setPlanStage("interrogation");
    setPlanStatus(null);
  }

  async function createPlanFromAnswers() {
    const selected = getSelectedPlanDocuments();
    if (selected.length === 0) {
      setPlanStatus("Select at least one source document.");
      return;
    }
    const incomplete = planQuestions.find((question) => !question.answer.trim() && !question.skipped);
    if (incomplete) {
      setPlanStatus("Answer each question or choose Skip for the ones you want ARM to assume.");
      return;
    }

    setBusy(true);
    try {
      const planName = `${selected[0]?.name || projectName} Plan`;
      const plan = await projectStore.createDocument(projectPath, planName, "PLAN");
      const markdown = buildPlanMarkdown({
        title: planName,
        mode: planMode,
        documents: selected,
        cards: getPlanningCards(),
        context: planContext,
        questions: planQuestions,
      });
      await projectStore.saveDocument(projectPath, plan.id, markdown);
      setPlanOpen(false);
      setPlanStage("setup");
      setPlanQuestions([]);
      await refreshAll();
      navigate(`/p/${encodeURIComponent(projectPath)}/documents/${plan.id}`);
      setStatus("Plan created.");
    } catch (error: any) {
      setPlanStatus(typeof error === "string" ? error : error?.message || "Plan creation failed.");
    } finally {
      setBusy(false);
    }
  }

  function getSelectedPlanDocuments() {
    return sourceDocuments.filter((document) => planSelectedDocIds.includes(document.id));
  }

  function getPlanningCards() {
    return cards.filter((card) => card.status === "accepted" || card.status === "resolved" || card.status === "edited");
  }

  async function submitPrompt() {
    const text = prompt.trim();
    if (!text) return;

    setSubmitBusy(true);
    try {
      await projectStore.addChatNote(projectPath, text, ["chat", "user", chatMode]);
      if (chatMode === "chat") {
        const newCards = await generateChatCards(text, chatMode);
        await projectStore.createAgentCards(projectPath, sourceAgentLabel(chatMode), newCards);
        setStatus(newCards.length > 1 ? "Chat cards added." : "Chat card added.");
        setCardFilter(firstVisibleCardFilter(newCards));
      } else {
        const newCards = await buildCardsForPrompt(text);
        await projectStore.createAgentCards(projectPath, sourceAgentLabel(chatMode), newCards);
        setStatus(newCards.length > 1 ? "Cards added." : "Card added.");
        setCardFilter(firstVisibleCardFilter(newCards));
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
    const heuristicFallback = (mode: "product" | "technical" | "everything") =>
      buildContextCardsFallback(text, mode);

    try {
      if (chatMode === "product") {
        const cards = await generateReviewCardsWithMode(text, "product");
        return ensureMinimumReviewCards(cards, heuristicFallback("product"), 3);
      }
      if (chatMode === "technical") {
        const cards = await generateReviewCardsWithMode(text, "technical");
        return ensureMinimumReviewCards(cards, heuristicFallback("technical"), 3);
      }
      const results = await Promise.allSettled([
        generateReviewCardsWithMode(text, "product"),
        generateReviewCardsWithMode(text, "technical"),
      ]);
      const merged = results
        .filter((item): item is PromiseFulfilledResult<NewAgentCardInput[]> => item.status === "fulfilled")
        .flatMap((item) => item.value);
      const overviewCard = await generateChatInfoCard(text, "chat").catch(() => fallbackInfoCard(text));
      const everythingCards = dedupeCards([overviewCard, ...merged]);
      if (everythingCards.length > 0) {
        return ensureMinimumReviewCards(everythingCards, heuristicFallback("everything"), 7).slice(0, 11);
      }
      throw new Error("LLM review failed.");
    } catch (error: any) {
      setStatus(`${typeof error === "string" ? error : error?.message || "LLM review failed."} Falling back to local review.`);
      const mode = chatMode === "everything" ? "everything" : (chatMode as "product" | "technical");
      return ensureMinimumReviewCards([], heuristicFallback(mode), mode === "everything" ? 7 : 3);
    }
  }

  async function generateReviewCardsWithMode(text: string, mode: "product" | "technical") {
    return generateReviewCardsWithLlm({
      prompt: text,
      mode,
      activeDocument,
      currentContext: activeContextMarkdown,
      notes,
      decisions,
      references,
    });
  }

  async function generateChatInfoCard(text: string, mode: ChatPersonaMode): Promise<NewAgentCardInput> {
    const reply = await generateChatReplyWithLlm({
      prompt: text,
      mode,
      activeDocument,
      currentContext: activeContextMarkdown,
      notes,
      decisions,
      references,
    });

    return {
      type: "info",
      title: chatInfoCardTitle(mode),
      body: reply,
      proposedUpdate: null,
      targetSection: null,
      sourceAgent: sourceAgentLabel(mode),
    };
  }

  async function generateChatCards(text: string, mode: ChatPersonaMode): Promise<NewAgentCardInput[]> {
    try {
      const cards = await generateChatCardsWithLlm({
        prompt: text,
        mode,
        activeDocument,
        currentContext: activeContextMarkdown,
        notes,
        decisions,
        references,
      });
      return cards.slice(0, 3);
    } catch {
      return [await generateChatInfoCard(text, mode)];
    }
  }

  function buildContextCardsFallback(text: string, mode: "product" | "technical" | "everything") {
    return buildReviewCards({
      prompt: text,
      mode,
      activeDocument,
      currentContext: activeContextMarkdown,
      notes,
      decisions,
      references,
    });
  }

  async function buildDocumentUpdate(text: string, kind: "note" | "decision") {
    if (!activeDocument) {
      throw new Error("Create and select a document before updating it.");
    }

    const baseInput = {
      kind,
      updateText: text,
      activeDocument,
      currentContext: activeContextMarkdown,
      notes,
      decisions,
      references,
    };

    if (chatMode === "everything") {
      const productPass = await generateDocumentUpdateWithLlm({ ...baseInput, mode: "product" });
      return generateDocumentUpdateWithLlm({
        ...baseInput,
        mode: "technical",
        currentContext: productPass,
        activeDocument: { ...activeDocument, markdown: productPass },
      });
    }

    return generateDocumentUpdateWithLlm({
      ...baseInput,
      mode: chatMode === "chat" ? "chat" : (chatMode as ChatPersonaMode),
    });
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

  function openResolveCard(card: AgentCard) {
    setResolveCard(card);
    setResolveKind("patch");
    setResolveText(card.proposedUpdate || card.body);
    setResolveStatus(null);
  }

  async function resolveCardNow() {
    if (!resolveCard) return;
    const trimmed = resolveText.trim();
    if (!trimmed) {
      setResolveStatus("Resolution text cannot be empty.");
      return;
    }
    if (!activeDocument) {
      setResolveStatus("Select a document before resolving a card.");
      return;
    }

    setBusy(true);
    try {
      const nextMarkdown =
        resolveKind === "patch"
          ? await buildDocumentUpdate(trimmed, "note")
          : applyResolutionToDocument(documentMarkdown, resolveKind, trimmed);
      await projectStore.saveDocument(projectPath, activeDocument.id, nextMarkdown);
      setDocumentMarkdown(nextMarkdown);
      if (resolveKind === "decision") {
        await projectStore.addDecision(projectPath, trimmed, null);
      }
      await projectStore.updateAgentCard(projectPath, resolveCard.id, { status: "accepted" });
      setResolveCard(null);
      setResolveText("");
      setResolveStatus(null);
      await refreshAll();
      setStatus("Card accepted.");
    } catch (error: any) {
      setResolveStatus(typeof error === "string" ? error : error?.message || "Resolve failed.");
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
          {!navCollapsed ? <div className="projectNameLine">{projectName}</div> : null}
          <button
            type="button"
            className="iconButton"
            aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setNavCollapsed((value) => !value)}
          >
            {navCollapsed ? ">" : "<"}
          </button>
        </div>

        {!navCollapsed ? (
          <>
            <div className="workspaceNavBlock">
              <div className="workspaceNavLabel">Project</div>
              <button
                type="button"
                className={"workspaceNavItem workspaceProjectContextButton" + (currentView === "context" ? " active" : "")}
                onClick={() => navigate(`/p/${encodeURIComponent(projectPath)}/context`)}
              >
                Context: {activeDocument?.name || "No document selected"}
              </button>
              <NavButton
                active={currentView === "references"}
                label={`References (${references.length})`}
                onClick={() => navigate(`/p/${encodeURIComponent(projectPath)}/references`)}
              />
            </div>

            <div className="workspaceNavBlock workspaceNavFill">
              <div className="workspaceNavLabel">Documents</div>
              <div className="documentList" aria-label="Documents">
                {sourceDocuments.map((document) => (
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
                {sourceDocuments.length === 0 ? <div className="documentNavEmpty">No documents yet</div> : null}
              </div>
              <div className="workspaceNavLabel">Plans</div>
              <div className="documentList" aria-label="Plans">
                {planDocuments.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    className={"documentNavItem" + (routeDocumentId === document.id ? " active" : "")}
                    onClick={() => navigate(`/p/${encodeURIComponent(projectPath)}/documents/${document.id}`)}
                  >
                    <span className="documentType">PLAN</span>
                    <span className="documentName">{document.name}</span>
                  </button>
                ))}
                {planDocuments.length === 0 ? <div className="documentNavEmpty">No plans yet</div> : null}
              </div>
              <div className="workspaceNavLabel">Decisions</div>
              <div className="documentList" aria-label="Decisions">
                {decisions.slice(0, 5).map((decision) => (
                  <button
                    key={decision.id}
                    type="button"
                    className={"documentNavItem decisionNavItem" + (currentView === "decisions" ? " active" : "")}
                    onClick={() => navigate(`/p/${encodeURIComponent(projectPath)}/decisions`)}
                    title={decision.text}
                  >
                    <span className="documentType">DEC</span>
                    <span className="documentName">{decision.text}</span>
                  </button>
                ))}
                {decisions.length === 0 ? <div className="documentNavEmpty">No decisions yet</div> : null}
              </div>
              <div className="workspaceNavLabel">Notes</div>
              <div className="documentList" aria-label="Notes">
                {stickyNotes.slice(0, 5).map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    className={"documentNavItem noteNavItem" + (currentView === "notes" ? " active" : "")}
                    onClick={() => navigate(`/p/${encodeURIComponent(projectPath)}/notes`)}
                    title={note.text}
                  >
                    <span className="documentType">NOTE</span>
                    <span className="documentName">{note.text}</span>
                  </button>
                ))}
                {stickyNotes.length === 0 ? <div className="documentNavEmpty">No notes yet</div> : null}
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
        <div className="segmentedControl sidebarFeatureBar">
          {(["info", "open_question", "warning", "action"] as CardFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              className={`segmentedPill cardTypePill cardTypePill-${filter}` + (cardFilter === filter ? " active" : "")}
              onClick={() => setCardFilter(filter)}
            >
              {cardFilterLabel(filter)} ({countCards(cards, filter, showDismissedCards)})
            </button>
          ))}
        </div>
        <div className="sidebarVisibilityControls">
          <label className="sidebarCheckbox">
            <input
              type="checkbox"
              checked={showAllCards}
              onChange={(event) => setShowAllCards(event.target.checked)}
            />
            <span>Show all</span>
          </label>
          <label className="sidebarCheckbox">
            <input
              type="checkbox"
              checked={showDismissedCards}
              onChange={(event) => setShowDismissedCards(event.target.checked)}
            />
            <span>Show dismissed</span>
          </label>
        </div>
        <div className="inputCardList unifiedStream">
          {sidebarItems.map((item) => (
            <SidebarItemView
              key={item.id}
              item={item}
              onAccept={openResolveCard}
              onDismiss={(card) => void setCardStatus(card, "rejected")}
            />
          ))}
          {sidebarItems.length === 0 ? <div className="muted">No activity here yet.</div> : null}
        </div>
        <div className="sidebarComposer">
          <textarea
            className="sidebarComposerInput"
            value={prompt}
            placeholder={composerPlaceholder(chatMode)}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !submitBusy) void submitPrompt();
            }}
          />
          <div className="segmentedControl sidebarActionBar">
            {(["chat", "product", "technical", "everything"] as ChatMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={"segmentedPill" + (chatMode === mode ? " active" : "")}
                onClick={() => setChatMode(mode)}
              >
                {chatModeLabel(mode)}
              </button>
            ))}
          </div>
          <div className="sidebarComposerFooter">
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
              <option value="PLAN">PLAN</option>
            </select>
            {newDocumentStatus ? <div className="status">{newDocumentStatus}</div> : null}
          </div>
        </Modal>
      ) : null}

      {updateOpen ? (
        <Modal
          title="Update"
          onClose={() => setUpdateOpen(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setUpdateOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={() => void applyUpdate()} disabled={busy}>
                Apply Update
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="segmentedControl sidebarActionBar">
              {(["note", "decision"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={"segmentedPill" + (updateKind === kind ? " active" : "")}
                  onClick={() => setUpdateKind(kind)}
                >
                  {kind === "note" ? "Note" : "Decision"}
                </button>
              ))}
            </div>
            <textarea
              className="miniEditor"
              value={updateText}
              placeholder={updateKind === "note" ? "What should be added or changed?" : "State the decision to apply."}
              onChange={(event) => setUpdateText(event.target.value)}
            />
            <div className="surfaceCopy">
              {updateKind === "decision"
                ? "This will patch the active document and add the decision to the decision log."
                : "This will patch the active document and store the note in project notes."}
            </div>
            {updateStatus ? <div className="status">{updateStatus}</div> : null}
          </div>
        </Modal>
      ) : null}

      {planOpen ? (
        <Modal
          title="Plan Mode"
          onClose={() => setPlanOpen(false)}
          footer={
            planStage === "setup" ? (
              <>
                <button type="button" className="secondary" onClick={() => setPlanOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="primary" onClick={startPlanningInterrogation} disabled={busy}>
                  Start Planning
                </button>
              </>
            ) : (
              <>
                <button type="button" className="secondary" onClick={() => setPlanStage("setup")}>
                  Back
                </button>
                <button type="button" className="primary" onClick={() => void createPlanFromAnswers()} disabled={busy}>
                  Continue
                </button>
              </>
            )
          }
        >
          {planStage === "setup" ? (
            <div className="stack">
              <div className="settingsSection">
                <div className="settingsLabel">Source Selection</div>
                <div className="surfaceCopy">{planSelectedDocIds.length} documents selected</div>
                <div className="planSourceList">
                  {sourceDocuments.map((document) => (
                    <label key={document.id} className="planSourceItem">
                      <input
                        type="checkbox"
                        checked={planSelectedDocIds.includes(document.id)}
                        onChange={() => togglePlanSource(document.id)}
                      />
                      <span className="documentType">{document.type}</span>
                      <span className="documentName">{document.name}</span>
                    </label>
                  ))}
                </div>
                <div className="settingsMeta">
                  Planning uses accepted cards when available. If no accepted cards exist, ARM uses the selected full documents.
                </div>
              </div>

              <div className="settingsSection">
                <div className="settingsLabel">Context Injection</div>
                <textarea
                  className="miniEditor"
                  value={planContext}
                  placeholder={"Add constraints, goals, or context (optional)\n\nI have 3 days max\nThis is for a portfolio project\nBackend already exists"}
                  onChange={(event) => setPlanContext(event.target.value)}
                />
              </div>

              <div className="settingsSection">
                <div className="settingsLabel">Mode</div>
                <div className="segmentedControl planModeBar">
                  {(["focused", "kill"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={"segmentedPill" + (planMode === mode ? " active" : "")}
                      onClick={() => setPlanMode(mode)}
                    >
                      {mode === "focused" ? "Focused Plan" : "Kill Plan"}
                    </button>
                  ))}
                </div>
              </div>
              {planStatus ? <div className="status">{planStatus}</div> : null}
            </div>
          ) : (
            <div className="stack">
              <div className="surfaceTitle">We need clarification before planning</div>
              {planQuestions.map((question, index) => (
                <div key={question.id} className="planQuestion">
                  <div className="reviewCardTitle">{index + 1}. {question.question}</div>
                  <div className="surfaceCopy">Why it matters: {question.why}</div>
                  <div className="surfaceCopy">Impact: {question.impact}</div>
                  <div className="feedMeta">Source: {question.source}</div>
                  <textarea
                    className="miniEditor planAnswerInput"
                    value={question.answer}
                    disabled={question.skipped}
                    placeholder="Answer inline..."
                    onChange={(event) =>
                      setPlanQuestions((current) =>
                        current.map((item) => item.id === question.id ? { ...item, answer: event.target.value } : item),
                      )
                    }
                  />
                  <label className="sidebarCheckbox">
                    <input
                      type="checkbox"
                      checked={question.skipped}
                      onChange={(event) =>
                        setPlanQuestions((current) =>
                          current.map((item) =>
                            item.id === question.id ? { ...item, skipped: event.target.checked, answer: event.target.checked ? "" : item.answer } : item,
                          ),
                        )
                      }
                    />
                    <span>Skip (assume default)</span>
                  </label>
                </div>
              ))}
              {planStatus ? <div className="status">{planStatus}</div> : null}
            </div>
          )}
        </Modal>
      ) : null}

      {resolveCard ? (
        <Modal
          title="Resolve Card"
          onClose={() => setResolveCard(null)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setResolveCard(null)}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={() => void resolveCardNow()} disabled={busy}>
                Resolve
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="segmentedControl resolveActionBar">
              {(["patch", "decision", "open_question"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={"segmentedPill" + (resolveKind === kind ? " active" : "")}
                  onClick={() => setResolveKind(kind)}
                >
                  {resolveKindLabel(kind)}
                </button>
              ))}
            </div>
            <textarea className="miniEditor" value={resolveText} onChange={(event) => setResolveText(event.target.value)} />
            <div className="surfaceCopy">
              {resolveKindDescription(resolveKind)}
            </div>
            {resolveStatus ? <div className="status">{resolveStatus}</div> : null}
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
          actions={<button type="button" className="secondary" onClick={() => setChatMode("chat")}>Use chat mode</button>}
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
          actions={<button type="button" className="primary" onClick={() => setUpdateOpen(true)}>Update</button>}
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
          description="Reviews generate small cards. Accept the useful ones, reject the noise, and keep the working document sharp."
        >
          <div className="reviewSummaryGrid">
            <SummaryTile label="Pending" value={String(cards.filter((card) => card.status === "pending").length)} />
            <SummaryTile label="Resolved" value={String(cards.filter((card) => card.status === "resolved" || card.status === "accepted" || card.status === "edited").length)} />
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
            <div className="row">
              {activeDocument?.type === "PLAN" ? (
                <button
                  type="button"
                  className="iconButton"
                  title="Re-plan"
                  aria-label="Re-plan"
                  onClick={() => rerunPlan(activeDocument)}
                >
                  <LightningIcon />
                </button>
              ) : null}
              <button
                type="button"
                className="iconButton"
                title="Copy document"
                aria-label="Copy document"
                disabled={!activeDocument}
                onClick={() => void copyDocumentNow()}
              >
                <CopyIcon />
              </button>
              <button
                type="button"
                className="iconButton iconButton-primary"
                title="Save document"
                aria-label="Save document"
                disabled={!activeDocument || busy}
                onClick={() => void saveDocumentNow()}
              >
                <SaveIcon />
              </button>
            </div>
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
            <button
              type="button"
              className="iconButton"
              title="Update document"
              aria-label="Update document"
              disabled={!activeDocument}
              onClick={() => setUpdateOpen(true)}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              className="iconButton"
              title="Plan mode"
              aria-label="Plan mode"
              disabled={sourceDocuments.length === 0}
              onClick={openPlanMode}
            >
              <LightningIcon />
            </button>
            <button
              type="button"
              className="iconButton"
              title="Copy document"
              aria-label="Copy document"
              disabled={!activeDocument}
              onClick={() => void copyDocumentNow()}
            >
              <CopyIcon />
            </button>
            <button
              type="button"
              className="iconButton iconButton-primary"
              title="Save document"
              aria-label="Save document"
              disabled={busy || !activeDocument}
              onClick={() => void saveDocumentNow()}
            >
              <SaveIcon />
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
  | { kind: "chat"; id: string; createdAt: string; text: string; tags: string[] | null }
  | { kind: "note"; id: string; createdAt: string; text: string }
  | { kind: "decision"; id: string; createdAt: string; text: string; reason: string | null }
  | { kind: "card"; id: string; createdAt: string; card: AgentCard };

function buildSidebarItems(
  cards: AgentCard[],
  cardFilter: CardFilter,
  showAllCards: boolean,
  showDismissedCards: boolean,
): SidebarItem[] {
  return cards
    .filter((card) => (showAllCards || card.type === cardFilter) && (showDismissedCards || card.status !== "rejected"))
    .map((card) => ({ kind: "card" as const, id: card.id, createdAt: card.createdAt, card }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function countCards(cards: AgentCard[], cardFilter: CardFilter, showDismissedCards: boolean) {
  return cards.filter((card) => card.type === cardFilter && (showDismissedCards || card.status !== "rejected")).length;
}

function SidebarItemView(props: {
  item: SidebarItem;
  onAccept: (card: AgentCard) => void;
  onDismiss: (card: AgentCard) => void;
}) {
  const item = props.item;
  if (item.kind === "chat") {
    return (
      <div className="streamItem streamItem-chat">
        <div className="streamMeta">{chatStreamLabel(item.tags)} | {formatTime(item.createdAt)}</div>
        <div>{item.text}</div>
      </div>
    );
  }

  if (item.kind === "note") {
    return (
      <div className="streamItem streamItem-note">
        <div className="streamMeta">Note | {formatTime(item.createdAt)}</div>
        <div>{item.text}</div>
      </div>
    );
  }

  if (item.kind === "decision") {
    return (
      <div className="streamItem streamItem-decision">
        <div className="streamMeta">Decision | {formatTime(item.createdAt)}</div>
        <div className="reviewCardTitle">{item.text}</div>
        {item.reason ? <div className="surfaceCopy">{item.reason}</div> : null}
      </div>
    );
  }

  const card = item.card;
  return (
    <div className={"reviewCard reviewCard-" + card.status}>
      <div className="reviewCardHeader">
        <span className={"reviewCardType cardTypeBadge cardTypeBadge-" + card.type}>{formatCardType(card.type)}</span>
        <span className="reviewCardStatus">{card.status}</span>
      </div>
      <div className="reviewCardTitle">{card.title}</div>
      <div className="reviewCardBody">{card.body}</div>
      {card.proposedUpdate ? <div className="reviewCardUpdate">{card.proposedUpdate}</div> : null}
      <div className="reviewCardActions">
        <button type="button" className="secondary" onClick={() => props.onAccept(card)}>
          Accept
        </button>
        <button type="button" className="secondary" onClick={() => props.onDismiss(card)}>
          Dismiss
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

function formatCardType(value: string) {
  if (value === "info") return "info";
  if (value === "open_question") return "open question";
  if (value === "action") return "next step";
  if (value === "warning") return "warning";
  return value.replace(/_/g, " ");
}

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function isReferenceFile(name: string) {
  const lowered = name.toLowerCase();
  return acceptedReferenceTypes.some((suffix) => lowered.endsWith(suffix));
}

function cardFilterLabel(filter: CardFilter) {
  if (filter === "info") return "Info";
  if (filter === "open_question") return "Question";
  if (filter === "warning") return "Warning";
  return "Next Steps";
}

function chatModeLabel(mode: ChatMode) {
  if (mode === "chat") return "Chat";
  if (mode === "product") return "Product";
  if (mode === "technical") return "Technical";
  return "Everything";
}

function chatInfoCardTitle(mode: ChatPersonaMode) {
  if (mode === "product") return "Product response";
  if (mode === "technical") return "Technical response";
  return "Assistant response";
}

function resolveKindLabel(kind: ResolveKind) {
  if (kind === "patch") return "Patch";
  if (kind === "decision") return "Decision";
  return "Open Questions";
}

function resolveKindDescription(kind: ResolveKind) {
  if (kind === "patch") {
    return "This will use the patch flow to integrate the text into the active document and accept the card.";
  }
  if (kind === "decision") {
    return "This will add the text under Decision Log, add it to the project decision log, and accept the card.";
  }
  return "This will add the text under Open Questions and accept the card.";
}

function applyResolutionToDocument(markdown: string, kind: Exclude<ResolveKind, "patch">, text: string) {
  const section = kind === "decision" ? "Decision Log" : "Open Questions";
  return appendListItemToSection(markdown, section, text);
}

function appendListItemToSection(markdown: string, sectionTitle: string, text: string) {
  const normalized = markdown.trimEnd();
  const item = `- ${text}`;
  const headingPattern = new RegExp(`(^|\\n)##\\s+${escapeRegExp(sectionTitle)}\\s*\\n`, "i");
  const match = headingPattern.exec(normalized);

  if (!match || match.index === undefined) {
    return `${normalized}\n\n## ${sectionTitle}\n${item}\n`;
  }

  const sectionStart = match.index + match[0].length;
  const nextHeadingIndex = normalized.slice(sectionStart).search(/\n##\s+/);
  if (nextHeadingIndex === -1) {
    return `${normalized.slice(0, sectionStart)}${item}\n${normalized.slice(sectionStart).replace(/^\s+/, "")}\n`;
  }

  const insertAt = sectionStart + nextHeadingIndex;
  const before = normalized.slice(0, insertAt).trimEnd();
  const after = normalized.slice(insertAt);
  return `${before}\n${item}\n${after}\n`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPlanQuestions(
  documents: ProjectDocument[],
  acceptedCards: AgentCard[],
  context: string,
  mode: PlanMode,
): PlanQuestion[] {
  const primaryDocument = documents[0];
  const cardSource = acceptedCards[0];
  const contextProvided = context.trim().length > 0;
  const questions: PlanQuestion[] = [
    {
      id: "outcome",
      question: mode === "kill" ? "What evidence would prove this is not worth building?" : "What outcome must this plan change first?",
      why: cardSource
        ? `Linked to critique: ${cardSource.title}`
        : "The plan needs a decision target, not just a list of work.",
      impact: "Without this, initiatives can become generic work items instead of decision-driving steps.",
      source: cardSource ? `${cardSource.sourceAgent}: ${cardSource.title}` : primaryDocument?.name || "Selected documents",
      answer: "",
      skipped: false,
    },
    {
      id: "constraint",
      question: contextProvided ? "Which injected constraint is non-negotiable?" : "What constraint should ARM assume if none is provided?",
      why: "Constraints make the plan specific to this situation.",
      impact: "Without a constraint, the plan may recommend work that is too large, too slow, or irrelevant.",
      source: contextProvided ? "User context" : primaryDocument?.name || "Selected documents",
      answer: "",
      skipped: false,
    },
    {
      id: "signal",
      question: "What signal should decide Proceed, Iterate, or Kill after execution?",
      why: "ARM needs a decision gate so the plan does not become open-ended activity.",
      impact: "Without a signal, the plan can be completed without changing the decision.",
      source: acceptedCards.length > 0 ? "Accepted cards" : "Selected documents",
      answer: "",
      skipped: false,
    },
  ];

  return questions;
}

function buildPlanMarkdown(args: {
  title: string;
  mode: PlanMode;
  documents: ProjectDocument[];
  cards: AgentCard[];
  context: string;
  questions: PlanQuestion[];
}) {
  const sourceCards = args.cards.length > 0 ? args.cards : [];
  const answered = args.questions.map((question) => ({
    ...question,
    finalAnswer: question.skipped ? defaultAnswerForQuestion(question.id, args.mode) : question.answer.trim(),
  }));
  const initiativeSeeds = sourceCards.length > 0
    ? sourceCards.slice(0, 3).map((card) => ({
        source: `${card.sourceAgent}: ${card.title}`,
        why: card.body,
        action: card.proposedUpdate || card.body,
      }))
    : args.documents.slice(0, 3).map((document) => ({
        source: `${document.type}: ${document.name}`,
        why: firstMeaningfulLine(document.markdown) || "Selected as a planning source.",
        action: args.mode === "kill" ? "Run the smallest test that could disprove this direction." : "Turn the strongest source signal into one bounded next step.",
      }));

  const initiatives = initiativeSeeds.slice(0, 3).map((seed, index) => {
    const constraint = answered.find((question) => question.id === "constraint")?.finalAnswer || "Keep scope small.";
    const signal = answered.find((question) => question.id === "signal")?.finalAnswer || "Use the result to decide proceed, iterate, or kill.";
    const action = args.mode === "kill"
      ? `Try to invalidate this direction: ${seed.action}`
      : seed.action;
    return [
      `## Initiative ${index + 1}`,
      `Source: ${seed.source}`,
      `Why: ${trimSentence(seed.why)}`,
      `Action: ${trimSentence(action)} Constraint: ${trimSentence(constraint)}`,
      `Success Signal: ${trimSentence(signal)}`,
      "",
    ].join("\n");
  });

  return ensureTrailingNewline([
    `# ${args.title}`,
    "",
    `Mode: ${args.mode === "kill" ? "Kill Plan" : "Focused Plan"}`,
    "",
    "## Planning Context",
    args.context.trim() || "- No additional context supplied.",
    "",
    "## Clarifications",
    ...answered.map((question) => `- ${question.question} ${question.finalAnswer}`),
    "",
    ...initiatives,
    "## Decision after execution",
    "- [ ] Proceed",
    "- [ ] Iterate",
    "- [ ] Kill",
    "",
  ].join("\n"));
}

function defaultAnswerForQuestion(id: string, mode: PlanMode) {
  if (id === "outcome") return mode === "kill" ? "Assume the goal is to find the cheapest invalidating signal." : "Assume the goal is to reduce the largest planning risk.";
  if (id === "constraint") return "Assume the plan must be small, local, and executable without new infrastructure.";
  return "Assume the decision gate is based on observable user or implementation signal.";
}

function firstMeaningfulLine(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && line !== "-");
}

function trimSentence(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
}

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function firstVisibleCardFilter(cards: NewAgentCardInput[]): CardFilter {
  return cards.some((card) => card.type === "info") ? "info" : cards[0]?.type || "info";
}

function ensureMinimumReviewCards(
  cards: NewAgentCardInput[],
  fallbackCards: NewAgentCardInput[],
  minimum: number,
): NewAgentCardInput[] {
  const combined = dedupeCards([...cards, ...fallbackCards, ...syntheticReviewCards(cards, fallbackCards)]);
  if (combined.length >= minimum) return combined;
  const toppedUp = [...combined];
  while (toppedUp.length < minimum) {
    toppedUp.push(supplementalReviewCard(toppedUp.length + 1, toppedUp[0]?.sourceAgent || "ARM Review"));
  }
  return dedupeCards(toppedUp).slice(0, minimum);
}

function syntheticReviewCards(primary: NewAgentCardInput[], fallback: NewAgentCardInput[]): NewAgentCardInput[] {
  const cards = [...primary, ...fallback];
  const sourceAgent = cards[0]?.sourceAgent || "ARM Review";
  const missing: NewAgentCardInput[] = [];

  if (!cards.some((card) => card.type === "info")) {
    missing.push({
      type: "info",
      title: "Review orientation",
      body: "This review should be read as decision support for the active document, not as an automatic approval to build.",
      proposedUpdate: null,
      targetSection: "Current direction",
      sourceAgent,
    });
  }
  if (!cards.some((card) => card.type === "warning")) {
    missing.push({
      type: "warning",
      title: "Unvalidated assumption",
      body: "The current direction still depends on an assumption that should be made explicit before the next build or planning step.",
      proposedUpdate: "Add the riskiest assumption and the cheapest way to test it.",
      targetSection: "Risks",
      sourceAgent,
    });
  }
  if (!cards.some((card) => card.type === "open_question")) {
    missing.push({
      type: "open_question",
      title: "Decision criteria",
      body: "The document should name what evidence would make this direction a yes, no, or revise decision.",
      proposedUpdate: "Add decision criteria for continuing, changing, or stopping this work.",
      targetSection: "Open questions",
      sourceAgent,
    });
  }
  if (!cards.some((card) => card.type === "action")) {
    missing.push({
      type: "action",
      title: "Next validation step",
      body: "Pick one small action that reduces uncertainty before the scope expands.",
      proposedUpdate: "Add one concrete next step with an owner or completion condition.",
      targetSection: "Next actions",
      sourceAgent,
    });
  }

  return missing;
}

function fallbackInfoCard(prompt: string): NewAgentCardInput {
  return {
    type: "info",
    title: "Combined review",
    body: `Review requested: ${prompt}`,
    proposedUpdate: null,
    targetSection: "Current direction",
    sourceAgent: "ARM Assistant",
  };
}

function supplementalReviewCard(index: number, sourceAgent: string): NewAgentCardInput {
  const templates: NewAgentCardInput[] = [
    {
      type: "action",
      title: "Confirm the next move",
      body: "The review needs one explicit next move so the team can act instead of continuing to discuss the whole problem space.",
      proposedUpdate: "Add the next concrete move and the condition that marks it complete.",
      targetSection: "Next actions",
      sourceAgent,
    },
    {
      type: "open_question",
      title: "Resolve the main uncertainty",
      body: "The active document should name the most important unanswered question before more scope is added.",
      proposedUpdate: "Add the main open question that blocks a confident decision.",
      targetSection: "Open questions",
      sourceAgent,
    },
    {
      type: "warning",
      title: "Avoid false confidence",
      body: "The current direction may look more certain than the evidence supports.",
      proposedUpdate: "Add the weakest evidence point or biggest assumption.",
      targetSection: "Risks",
      sourceAgent,
    },
  ];
  const card = templates[index % templates.length];
  return { ...card, title: `${card.title} ${index}` };
}

function composerPlaceholder(mode: ChatMode) {
  if (mode === "chat") return "Ask ARM anything about this document...";
  if (mode === "product") return "Ask the product persona to evaluate this...";
  if (mode === "technical") return "Ask the technical persona to evaluate this...";
  return "Send this to both product and technical personas...";
}

function isStickyNote(note: ChatNote) {
  return Array.isArray(note.tags) && note.tags.includes("note");
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect x="5" y="3" width="8" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 11.5V5.5C3.5 4.67 4.17 4 5 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M3 2.5h8l2 2V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 2.5v4h5v-4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="5" y="9" width="6" height="3" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M3.5 11.8 4.1 14l2.2-.6 6.9-6.9-2.8-2.8z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="m9.5 4.6 2.8 2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M8.8 1.8 3.7 8.6h3.5l-.6 5.6 5.6-7.4H8.7z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function chatStreamLabel(tags: string[] | null) {
  const safeTags = Array.isArray(tags) ? tags : [];
  const role = safeTags.includes("assistant") ? "Assistant" : "You";
  if (safeTags.includes("product")) return `${role} Product`;
  if (safeTags.includes("technical")) return `${role} Technical`;
  if (safeTags.includes("everything")) return `${role} Everything`;
  return `${role} Chat`;
}

function sourceAgentLabel(mode: ChatMode) {
  if (mode === "product") return "CPO Agent";
  if (mode === "technical") return "Engineering Agent";
  if (mode === "everything") return "Combined Review";
  return "ARM Assistant";
}

function dedupeCards(cards: NewAgentCardInput[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.type}|${card.title}|${card.targetSection || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function safeReadText(file: File) {
  try {
    const text = await file.text();
    return text.slice(0, 16000);
  } catch {
    return null;
  }
}

