import React from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { buildReviewCards, summarizeReferenceText } from "../../core/armEngine";
import {
  ChatPersonaMode,
  generateChatCardsWithLlm,
  generateChatReplyWithLlm,
  generateDocumentUpdateWithLlm,
  generatePlanWithLlm,
  generateReviewCardsWithLlm,
} from "../../core/llmReview";
import { buildFallbackPlanModel, renderPlanMarkdown } from "../../core/planModel";
import { buildPlanQuestions, PlanMode, PlanQuestion, PlanStage } from "../../core/planning";
import {
  AgentCard,
  ChatNote,
  Decision,
  DiagramEntity,
  DocumentType,
  NewAgentCardInput,
  ProjectDocument,
  ProjectReference,
  projectStore,
} from "../../core/projectStore";
import Modal from "../shared/Modal";
import { buildSidebarItems, cardFilterLabel, CardFilter, countCards, SidebarItemView } from "./cardSidebar";
import PlanModeModal from "./PlanModeModal";

type ViewKey = "context" | "notes" | "decisions" | "references" | "document";
type ChatMode = "chat" | "product" | "technical" | "everything";
type ResolveKind = "patch" | "decision" | "open_question";
type DiagramMode = "diagram" | "code";

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
  const projectName = projectPath.split(/[\\/]/).filter(Boolean).pop() || "Project";

  const [navCollapsed, setNavCollapsed] = React.useState(false);
  const [rightRailWidth, setRightRailWidth] = React.useState(420);
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
  const [newDocumentKind, setNewDocumentKind] = React.useState<"text" | "diagram">("text");
  const [newDocumentType, setNewDocumentType] = React.useState<DocumentType>("IDEA");
  const [newDocumentStatus, setNewDocumentStatus] = React.useState<string | null>(null);
  const [diagramMode, setDiagramMode] = React.useState<DiagramMode>("diagram");
  const [diagramMermaidDraft, setDiagramMermaidDraft] = React.useState("");
  const [diagramCodeEditing, setDiagramCodeEditing] = React.useState(false);
  const [addDiagramCardOpen, setAddDiagramCardOpen] = React.useState(false);
  const [diagramEntityMode, setDiagramEntityMode] = React.useState<"existing" | "new">("new");
  const [diagramEntityId, setDiagramEntityId] = React.useState("");
  const [diagramEntityName, setDiagramEntityName] = React.useState("");
  const [diagramResponsibility, setDiagramResponsibility] = React.useState("");
  const [diagramCollaboratorIds, setDiagramCollaboratorIds] = React.useState<string[]>([]);
  const [diagramNewCollaboratorName, setDiagramNewCollaboratorName] = React.useState("");
  const [diagramCardStatus, setDiagramCardStatus] = React.useState<string | null>(null);

  const [updateOpen, setUpdateOpen] = React.useState(false);
  const [updateText, setUpdateText] = React.useState("");
  const [updateKind, setUpdateKind] = React.useState<"note" | "decision">("note");
  const [updateStatus, setUpdateStatus] = React.useState<string | null>(null);

  const [resolveCard, setResolveCard] = React.useState<AgentCard | null>(null);
  const [resolveKind, setResolveKind] = React.useState<ResolveKind>("patch");
  const [resolveText, setResolveText] = React.useState("");
  const [resolveStatus, setResolveStatus] = React.useState<string | null>(null);

  const [planOpen, setPlanOpen] = React.useState(false);
  const [planStage, setPlanStage] = React.useState<PlanStage>("setup");
  const [planSelectedDocIds, setPlanSelectedDocIds] = React.useState<string[]>([]);
  const [planContext, setPlanContext] = React.useState("");
  const [planMode, setPlanMode] = React.useState<PlanMode>("focused");
  const [planQuestions, setPlanQuestions] = React.useState<PlanQuestion[]>([]);
  const [planStatus, setPlanStatus] = React.useState<string | null>(null);
  const [planGenerating, setPlanGenerating] = React.useState(false);
  const [activePlanPageIndex, setActivePlanPageIndex] = React.useState(0);

  const filesInputRef = React.useRef<HTMLInputElement | null>(null);
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);
  const draggingRightRail = React.useRef(false);

  const route = parseRoute(location.pathname);
  const currentView = route.view;
  const routeDocumentId = route.documentId;
  const activeContextMarkdown = activeDocument ? documentMarkdown : "";
  const stickyNotes = notes.filter(isStickyNote);
  const sidebarItems = buildSidebarItems(cards, cardFilter, showAllCards, showDismissedCards);
  const sourceDocuments = documents.filter((document) => document.type !== "PLAN");
  const planDocuments = documents.filter((document) => document.type === "PLAN");
  const rightRailOpen = rightRailWidth >= 220;

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
    if (nextDocument?.type === "PLAN") {
      setActivePlanPageIndex(0);
    }
    if (nextDocument?.type === "diagram") {
      setDiagramMode("diagram");
      setDiagramMermaidDraft(nextDocument.mermaid || "");
      setDiagramCodeEditing(false);
    }
  }, [documents, routeDocumentId, projectPath]);

  React.useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!draggingRightRail.current) return;
      const nextWidth = Math.min(520, Math.max(40, window.innerWidth - event.clientX));
      setRightRailWidth(nextWidth);
    }

    function onPointerUp() {
      draggingRightRail.current = false;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

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

  async function savePlanPageNow(page: PlanPage, content: string) {
    if (!activeDocument || activeDocument.type !== "PLAN" || page.kind !== "document") return;
    const nextMarkdown = replacePlanPageMarkdown(documentMarkdown, page, content);
    setBusy(true);
    try {
      await projectStore.saveDocument(projectPath, activeDocument.id, nextMarkdown);
      setDocumentMarkdown(nextMarkdown);
      setStatus(`${page.title} saved.`);
      await refreshAll();
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Plan page save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePlanNow(document: ProjectDocument) {
    if (document.type !== "PLAN") return;
    const confirmed = window.confirm(`Delete plan "${document.name}"?`);
    if (!confirmed) return;

    setBusy(true);
    try {
      await projectStore.deleteDocument(projectPath, document.id);
      setActiveDocument(null);
      setDocumentMarkdown("");
      setActivePlanPageIndex(0);
      await refreshAll();
      navigate(`/p/${encodeURIComponent(projectPath)}/context`);
      setStatus("Plan deleted.");
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Delete failed.");
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
    setPlanGenerating(true);
    try {
      const documentType = newDocumentKind === "diagram" ? "diagram" : newDocumentType;
      const document = await projectStore.createDocument(projectPath, trimmed, documentType);
      setAddDocumentOpen(false);
      setNewDocumentName("");
      setNewDocumentKind("text");
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

  async function openAddDiagramCard() {
    if (!activeDocument || activeDocument.type !== "diagram") return;
    setBusy(true);
    try {
      const latestDocument = await projectStore.loadDocument(projectPath, activeDocument.id);
      setDocuments((current) => current.map((document) => (document.id === latestDocument.id ? latestDocument : document)));
      setActiveDocument(latestDocument);
      setDocumentMarkdown(latestDocument.markdown);
      setDiagramMermaidDraft(latestDocument.mermaid || "");

      const firstEntity = latestDocument.entities[0];
      setDiagramEntityMode(firstEntity ? "existing" : "new");
      setDiagramEntityId(firstEntity?.id || "");
      setDiagramEntityName("");
      setDiagramResponsibility(firstEntity?.responsibility || "");
      setDiagramCollaboratorIds(firstEntity?.collaborators || []);
      setDiagramNewCollaboratorName("");
      setDiagramCardStatus(null);
      setAddDiagramCardOpen(true);
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Failed to load latest diagram.");
    } finally {
      setBusy(false);
    }
  }

  function pickDiagramEntity(entityId: string) {
    const entity = activeDocument?.entities.find((item) => item.id === entityId);
    setDiagramEntityId(entityId);
    setDiagramResponsibility(entity?.responsibility || "");
    setDiagramCollaboratorIds(entity?.collaborators || []);
  }

  function toggleDiagramCollaborator(entityId: string) {
    setDiagramCollaboratorIds((current) =>
      current.includes(entityId) ? current.filter((id) => id !== entityId) : [...current, entityId],
    );
  }

  async function saveDiagramCard() {
    if (!activeDocument || activeDocument.type !== "diagram") return;
    setBusy(true);
    try {
      const latestDocument = await projectStore.loadDocument(projectPath, activeDocument.id);
      const existingEntities = latestDocument.entities || [];
      const editingExisting = diagramEntityMode === "existing";
      const selectedEntity = existingEntities.find((entity) => entity.id === diagramEntityId);
      const name = editingExisting ? selectedEntity?.name || "" : diagramEntityName.trim();
      if (!name) {
        setDiagramCardStatus("Entity name is required.");
        return;
      }

      const entityId = editingExisting && selectedEntity ? selectedEntity.id : createLocalId(name);
      const newCollaboratorName = diagramNewCollaboratorName.trim();
      const newCollaborator: DiagramEntity | null = newCollaboratorName
        ? {
            id: createLocalId(newCollaboratorName),
            name: newCollaboratorName,
            responsibility: "",
            collaborators: [],
          }
        : null;
      const collaboratorIds = uniqueIds([
        ...diagramCollaboratorIds.filter((id) => id !== entityId),
        ...(newCollaborator ? [newCollaborator.id] : []),
      ]);

      const nextEntity: DiagramEntity = {
        id: entityId,
        name,
        responsibility: diagramResponsibility.trim(),
        collaborators: collaboratorIds,
      };
      const nextEntities = existingEntities.filter((entity) => entity.id !== entityId);
      if (newCollaborator && !nextEntities.some((entity) => entity.id === newCollaborator.id)) {
        nextEntities.push(newCollaborator);
      }
      nextEntities.push(nextEntity);

      const saved = await projectStore.saveDiagramDocument(projectPath, activeDocument.id, nextEntities);
      setDocuments((current) => current.map((document) => (document.id === saved.id ? saved : document)));
      setActiveDocument(saved);
      setDocumentMarkdown(saved.markdown);
      setDiagramMermaidDraft(saved.mermaid || "");
      setDiagramCodeEditing(false);
      setAddDiagramCardOpen(false);
      setDiagramCardStatus(null);
      setStatus("Diagram saved.");
    } catch (error: any) {
      setDiagramCardStatus(typeof error === "string" ? error : error?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDiagramCodeNow() {
    if (!activeDocument || activeDocument.type !== "diagram") return;
    setBusy(true);
    try {
      const saved = await projectStore.saveDiagramMermaid(projectPath, activeDocument.id, diagramMermaidDraft);
      setDocuments((current) => current.map((document) => (document.id === saved.id ? saved : document)));
      setActiveDocument(saved);
      setDiagramMermaidDraft(saved.mermaid || "");
      setDiagramCodeEditing(false);
      setStatus("Diagram code saved.");
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Save failed.");
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
    setPlanGenerating(true);
    try {
      const planTimecode = formatPlanTimecode(new Date());
      const planName = `${selected[0]?.name || projectName} Plan ${planTimecode}`;
      const plan = await projectStore.createDocument(projectPath, planName, "PLAN");
      const planningCards = getPlanningCards();
      const fallbackMarkdown = ensurePlanTimecode(
        renderPlanMarkdown(buildFallbackPlanModel({
          title: planName,
          mode: planMode,
          documents: selected,
          cards: planningCards,
          context: planContext,
          questions: planQuestions,
        })),
        planTimecode,
      );
      let markdown = fallbackMarkdown;
      let usedFallback = false;
      try {
        markdown = ensurePlanTimecode(
          await generatePlanWithLlm({
            title: planName,
            mode: planMode,
            documents: selected,
            cards: planningCards,
            context: planContext,
            questions: planQuestions,
          }),
          planTimecode,
        );
      } catch (error) {
        usedFallback = true;
        console.warn("[arm-plan] LLM generation failed; using deterministic fallback.", error);
      }
      await projectStore.saveDocument(projectPath, plan.id, markdown);
      setPlanOpen(false);
      setPlanStage("setup");
      setPlanQuestions([]);
      await refreshAll();
      navigate(`/p/${encodeURIComponent(projectPath)}/documents/${plan.id}`);
      setStatus(usedFallback ? "Plan created with local fallback because generation failed." : "Plan generated.");
    } catch (error: any) {
      setPlanStatus(typeof error === "string" ? error : error?.message || "Plan creation failed.");
    } finally {
      setPlanGenerating(false);
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
      projectPath,
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
      projectPath,
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
        projectPath,
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
      projectPath,
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

  return (
    <div
      className={
        "workspace armWorkspace" +
        (navCollapsed ? " navCollapsed" : "") +
        (!rightRailOpen ? " rightRailCompact" : "")
      }
      style={{ "--right-rail-width": `${rightRailWidth}px` } as React.CSSProperties}
    >
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
        <div
          className="rightRailResizeHandle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize activity sidebar"
          onPointerDown={(event) => {
            draggingRightRail.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
        />
        {!rightRailOpen ? (
          <button
            type="button"
            className="iconButton rightRailOpenButton"
            title="Open activity sidebar"
            aria-label="Open activity sidebar"
            onClick={() => setRightRailWidth(420)}
          >
            {"<"}
          </button>
        ) : (
          <>
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
          </>
        )}
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
            <div className="segmentedControl documentKindBar">
              {(["text", "diagram"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={"segmentedPill" + (newDocumentKind === kind ? " active" : "")}
                  onClick={() => setNewDocumentKind(kind)}
                >
                  {kind === "text" ? "Text" : "Diagram"}
                </button>
              ))}
            </div>
            <input
              autoFocus
              className="textInput"
              value={newDocumentName}
              placeholder="Document name"
              onChange={(event) => setNewDocumentName(event.target.value)}
            />
            {newDocumentKind === "text" ? (
              <select
                className="selectInput"
                value={newDocumentType}
                onChange={(event) => setNewDocumentType(event.target.value as DocumentType)}
              >
                <option value="IDEA">IDEA</option>
                <option value="PRD">PRD</option>
                <option value="PLAN">PLAN</option>
              </select>
            ) : null}
            {newDocumentStatus ? <div className="status">{newDocumentStatus}</div> : null}
          </div>
        </Modal>
      ) : null}

      {addDiagramCardOpen && activeDocument?.type === "diagram" ? (
        <Modal
          title="Add Card"
          onClose={() => setAddDiagramCardOpen(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setAddDiagramCardOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={() => void saveDiagramCard()} disabled={busy}>
                Save
              </button>
            </>
          }
        >
          <div className="stack">
            <label className="fieldLabel">Entity</label>
            <select
              className="selectInput"
              value={diagramEntityMode === "existing" ? diagramEntityId : "__new"}
              onChange={(event) => {
                if (event.target.value === "__new") {
                  setDiagramEntityMode("new");
                  setDiagramEntityId("");
                  setDiagramResponsibility("");
                  setDiagramCollaboratorIds([]);
                } else {
                  setDiagramEntityMode("existing");
                  pickDiagramEntity(event.target.value);
                }
              }}
            >
              {activeDocument.entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
              <option value="__new">+ New Entity</option>
            </select>
            {diagramEntityMode === "new" ? (
              <input
                className="textInput"
                value={diagramEntityName}
                placeholder="Entity name"
                onChange={(event) => setDiagramEntityName(event.target.value)}
              />
            ) : null}

            <label className="fieldLabel">Responsibility</label>
            <textarea
              className="textInput diagramTextarea"
              value={diagramResponsibility}
              placeholder="Responsibility"
              onChange={(event) => setDiagramResponsibility(event.target.value)}
            />

            <label className="fieldLabel">Collaborators</label>
            <div className="diagramCollaboratorList">
              {activeDocument.entities
                .filter((entity) => entity.id !== diagramEntityId)
                .map((entity) => (
                  <label key={entity.id} className="diagramCollaborator">
                    <input
                      type="checkbox"
                      checked={diagramCollaboratorIds.includes(entity.id)}
                      onChange={() => toggleDiagramCollaborator(entity.id)}
                    />
                    <span>{entity.name}</span>
                  </label>
                ))}
              {activeDocument.entities.length === 0 ? <div className="muted">No existing entities yet.</div> : null}
            </div>
            <input
              className="textInput"
              value={diagramNewCollaboratorName}
              placeholder="+ New Collaborator"
              onChange={(event) => setDiagramNewCollaboratorName(event.target.value)}
            />
            {diagramCardStatus ? <div className="status">{diagramCardStatus}</div> : null}
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
        <PlanModeModal
          busy={busy}
          planStage={planStage}
          selectedDocIds={planSelectedDocIds}
          sourceDocuments={sourceDocuments}
          planContext={planContext}
          planMode={planMode}
          planQuestions={planQuestions}
          planStatus={planStatus}
          onClose={() => setPlanOpen(false)}
          onBack={() => setPlanStage("setup")}
          onStart={startPlanningInterrogation}
          onContinue={() => void createPlanFromAnswers()}
          onToggleSource={togglePlanSource}
          onContextChange={setPlanContext}
          onModeChange={setPlanMode}
          onQuestionsChange={setPlanQuestions}
        />
      ) : null}
      {planGenerating ? (
        <div className="generationOverlay" role="status" aria-live="polite">
          <div className="generationCard">
            <span className="spinner generationSpinner" aria-hidden="true" />
            <div className="surfaceTitle">Generating plan</div>
            <div className="surfaceCopy">Breaking this into initiatives, epics, tickets, and testing criteria.</div>
          </div>
        </div>
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

    if (currentView === "document") {
      if (activeDocument?.type === "diagram") {
        return (
          <FocusFrame
            title={activeDocument.name}
            description="Diagram document"
            actions={
              <div className="row">
                <button
                  type="button"
                  className="iconButton"
                  title="Copy Mermaid"
                  aria-label="Copy Mermaid"
                  onClick={() => void navigator.clipboard.writeText(diagramMermaidDraft)}
                >
                  <CopyIcon />
                </button>
                {diagramMode === "code" ? (
                  <>
                    <button
                      type="button"
                      className={"iconButton" + (diagramCodeEditing ? " active" : "")}
                      title="Edit diagram code"
                      aria-label="Edit diagram code"
                      disabled={busy}
                      onClick={() => setDiagramCodeEditing(true)}
                    >
                      <PencilIcon />
                    </button>
                    {diagramCodeEditing ? (
                      <button
                        type="button"
                        className="iconButton iconButton-primary"
                        title="Save diagram code"
                        aria-label="Save diagram code"
                        disabled={busy}
                        onClick={() => void saveDiagramCodeNow()}
                      >
                        <SaveIcon />
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            }
          >
            <div className="diagramDocument">
              <div className="segmentedControl diagramModeBar">
                {(["diagram", "code"] as DiagramMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={"segmentedPill" + (diagramMode === mode ? " active" : "")}
                    onClick={() => setDiagramMode(mode)}
                  >
                    {mode === "diagram" ? "DIAGRAM" : "CODE"}
                  </button>
                ))}
              </div>
              <div className="diagramViewport">
                {diagramMode === "diagram" ? (
                  <DiagramCanvas entities={activeDocument.entities || []} mermaid={activeDocument.mermaid || ""} />
                ) : (
                  <textarea
                    className="documentEditor diagramCode"
                    value={diagramMermaidDraft}
                    onChange={(event) => setDiagramMermaidDraft(event.target.value)}
                    readOnly={!diagramCodeEditing}
                    spellCheck={false}
                  />
                )}
              </div>
              <div className="diagramFooter">
                <button type="button" className="primary" onClick={openAddDiagramCard}>
                  Add Card
                </button>
              </div>
            </div>
            {status ? <div className="workspaceStatus">{status}</div> : null}
          </FocusFrame>
        );
      }

      if (activeDocument?.type === "PLAN") {
        const planPages = buildPlanPages(documentMarkdown);
        const activePage = planPages[Math.min(activePlanPageIndex, Math.max(0, planPages.length - 1))];
        return (
          <FocusFrame
            title={activeDocument.name}
            description="Plan folder"
            actions={
              <div className="row">
                <button
                  type="button"
                  className="iconButton dangerIconButton"
                  title="Delete plan"
                  aria-label="Delete plan"
                  disabled={busy}
                  onClick={() => void deletePlanNow(activeDocument)}
                >
                  <TrashIcon />
                </button>
                <button
                  type="button"
                  className="iconButton"
                  title="Re-plan"
                  aria-label="Re-plan"
                  onClick={() => rerunPlan(activeDocument)}
                >
                  <LightningIcon />
                </button>
                <button
                  type="button"
                  className="iconButton"
                  title="Copy plan"
                  aria-label="Copy plan"
                  onClick={() => void copyDocumentNow()}
                >
                  <CopyIcon />
                </button>
                <button
                  type="button"
                  className="iconButton iconButton-primary"
                  title="Save plan"
                  aria-label="Save plan"
                  disabled={busy}
                  onClick={() => void saveDocumentNow()}
                >
                  <SaveIcon />
                </button>
              </div>
            }
          >
            <PlanFolderView
              pages={planPages}
              activePageIndex={activePlanPageIndex}
              onPageChange={setActivePlanPageIndex}
              activePage={activePage}
              busy={busy}
              onSavePage={(page, content) => savePlanPageNow(page, content)}
            />
          </FocusFrame>
        );
      }

      return (
        <FocusFrame
          title={activeDocument?.name || "Document"}
          description={activeDocument ? `${activeDocument.type} document` : "Select a document from the left column."}
          actions={
            <div className="row">
              {isPlanningSourceDocument(activeDocument, documentMarkdown) ? (
                <>
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
                </>
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

type RenderedDiagramNode = {
  id: string;
  name: string;
  responsibility: string;
};

type PlanPage = {
  id: string;
  title: string;
  kind: "document" | "diagram";
  content: string;
  context?: string;
};

function PlanFolderView(props: {
  pages: PlanPage[];
  activePageIndex: number;
  activePage: PlanPage | undefined;
  onPageChange: (index: number) => void;
  busy: boolean;
  onSavePage: (page: PlanPage, content: string) => Promise<void>;
}) {
  const page = props.activePage || props.pages[0];
  const [editingPageId, setEditingPageId] = React.useState<string | null>(null);
  const [pageDraft, setPageDraft] = React.useState("");
  const editing = page?.kind === "document" && editingPageId === page.id;

  React.useEffect(() => {
    setEditingPageId(null);
    setPageDraft(page?.content || "");
  }, [page?.id]);

  if (!page) {
    return <div className="emptyContextState">No plan pages found.</div>;
  }

  async function saveCurrentPage() {
    if (!page || page.kind !== "document") return;
    await props.onSavePage(page, pageDraft);
    setEditingPageId(null);
  }

  return (
    <div className="planFolder">
      <div className="planPageRail" aria-label="Plan pages">
        {props.pages.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={"planPageTab" + (index === props.activePageIndex ? " active" : "")}
            onClick={() => props.onPageChange(index)}
          >
            <span className="documentType">{item.kind === "diagram" ? "DIAGRAM" : "PAGE"}</span>
            <span className="documentName">{item.title}</span>
          </button>
        ))}
      </div>
      <div className="planPageViewport">
        <div className="planPageHeader">
          <div className="surfaceTitle">{page.title}</div>
          <div className="planPageSubheader">
            <div className="feedMeta">{page.kind === "diagram" ? "Mermaid diagram page" : "Plan document page"}</div>
            {page.kind === "document" ? (
              <div className="row">
                <button
                  type="button"
                  className="iconButton"
                  title="Edit page"
                  aria-label="Edit page"
                  disabled={props.busy}
                  onClick={() => {
                    setEditingPageId(page.id);
                    setPageDraft(page.content);
                  }}
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  className="iconButton iconButton-primary"
                  title="Save page"
                  aria-label="Save page"
                  disabled={props.busy || !editing}
                  onClick={() => void saveCurrentPage()}
                >
                  <SaveIcon />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {page.kind === "diagram" ? (
          <PlanDiagramCanvas mermaid={page.content} title={page.title} context={page.context || ""} />
        ) : editing ? (
          <textarea
            className="documentEditor planPageEditor"
            value={pageDraft}
            onChange={(event) => setPageDraft(event.target.value)}
            spellCheck={false}
          />
        ) : (
          <pre className="planPageText">{page.content}</pre>
        )}
      </div>
    </div>
  );
}

function PlanDiagramCanvas(props: { mermaid: string; title: string; context: string }) {
  const parsed = parsePlanMermaidDiagram(props.mermaid, props.context, props.title);
  const root = parsed.nodes.find((node) => parsed.relationships.some((relationship) => relationship.sourceId === node.id));
  const children = root
    ? parsed.relationships
        .filter((relationship) => relationship.sourceId === root.id)
        .map((relationship) => parsed.nodes.find((node) => node.id === relationship.targetId))
        .filter((node): node is PlanDiagramNode => Boolean(node))
    : parsed.nodes.slice(1);

  if (!root) {
    return (
      <div className="diagramEmpty">
        <div className="surfaceTitle">No diagram data</div>
        <div className="surfaceCopy">This plan diagram has no readable parent and child work items.</div>
      </div>
    );
  }

  return (
    <div className="planDiagramCanvas" aria-label="Plan relationship diagram">
      <PlanWorkCard node={root} emphasis="parent" />
      <div className="planDiagramFanout" aria-hidden="true" />
      <div className="planDiagramChildren">
        {children.map((child) => (
          <div key={child.id} className="planDiagramChildRow">
            <div className="planDiagramArrow" aria-hidden="true" />
            <PlanWorkCard node={child} emphasis="child" />
          </div>
        ))}
      </div>
    </div>
  );
}

type PlanDiagramNode = {
  id: string;
  title: string;
  target: string;
};

function PlanWorkCard(props: { node: PlanDiagramNode; emphasis: "parent" | "child" }) {
  return (
    <div className={"planWorkCard " + props.emphasis}>
      <div className="planWorkCardTitle">{props.node.title}</div>
      <div className="planWorkCardTarget">{props.node.target || "Target: define the outcome of this block of work."}</div>
    </div>
  );
}

function DiagramCanvas(props: { entities: DiagramEntity[]; mermaid: string }) {
  const parsed = parseMermaidDiagram(props.mermaid);
  const nodes = parsed.nodes.length > 0
    ? parsed.nodes
    : props.entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        responsibility: entity.responsibility,
      }));
  const relationships = parsed.nodes.length > 0
    ? parsed.relationships
    : props.entities.flatMap((entity) =>
        entity.collaborators.map((collaboratorId) => ({
          sourceId: entity.id,
          targetId: collaboratorId,
        })),
      );

  if (nodes.length === 0) {
    return (
      <div className="diagramEmpty">
        <div className="surfaceTitle">No cards yet</div>
        <div className="surfaceCopy">Add a card to create the first diagram entity.</div>
      </div>
    );
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const renderedRelationships = relationships
    .map((relationship) => ({
      source: nodeById.get(relationship.sourceId),
      target: nodeById.get(relationship.targetId),
    }))
    .filter((relationship): relationship is { source: RenderedDiagramNode; target: RenderedDiagramNode } =>
      Boolean(relationship.source && relationship.target),
    );
  const connectedIds = new Set(renderedRelationships.flatMap((relationship) => [relationship.source.id, relationship.target.id]));
  const standalone = nodes.filter((node) => !connectedIds.has(node.id));

  return (
    <div className="diagramCanvas" aria-label="Rendered Mermaid diagram">
      {renderedRelationships.map((relationship) => (
        <div key={`${relationship.source.id}-${relationship.target.id}`} className="diagramRelationship">
          <DiagramNode node={relationship.source} />
          <div className="diagramArrow" aria-hidden="true" />
          <DiagramNode node={relationship.target} />
        </div>
      ))}
      {standalone.length > 0 ? (
        <div className="diagramStandalone">
          {standalone.map((node) => (
            <DiagramNode key={node.id} node={node} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DiagramNode(props: { node: RenderedDiagramNode }) {
  return (
    <div className="diagramNode">
      <div className="diagramNodeName">{props.node.name}</div>
      <div className="diagramNodeResponsibility">
        Responsibility: {props.node.responsibility || "Unassigned"}
      </div>
    </div>
  );
}

function parseMermaidDiagram(mermaid: string): {
  nodes: RenderedDiagramNode[];
  relationships: Array<{ sourceId: string; targetId: string }>;
} {
  const nodes = new Map<string, RenderedDiagramNode>();
  const relationships: Array<{ sourceId: string; targetId: string }> = [];

  for (const line of mermaid.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("flowchart") || trimmed.startsWith("graph")) continue;

    const relationshipMatch = /^([A-Za-z0-9_:-]+)\s*-->\s*([A-Za-z0-9_:-]+)/.exec(trimmed);
    if (relationshipMatch) {
      relationships.push({ sourceId: relationshipMatch[1], targetId: relationshipMatch[2] });
      continue;
    }

    const nodeMatch = /^([A-Za-z0-9_:-]+)\s*\[\s*"([^"]*)"\s*\]/.exec(trimmed);
    if (nodeMatch) {
      const label = nodeMatch[2].replace(/<br\s*\/?>/gi, "\n").replace(/\\"/g, '"');
      const lines = label.split(/\n+/).map((item) => item.trim()).filter(Boolean);
      const responsibilityLine = lines.find((item) => item.toLowerCase().startsWith("responsibility:"));
      nodes.set(nodeMatch[1], {
        id: nodeMatch[1],
        name: lines[0] || nodeMatch[1],
        responsibility: responsibilityLine?.replace(/^responsibility:\s*/i, "") || "",
      });
    }
  }

  for (const relationship of relationships) {
    if (!nodes.has(relationship.sourceId)) {
      nodes.set(relationship.sourceId, { id: relationship.sourceId, name: relationship.sourceId, responsibility: "" });
    }
    if (!nodes.has(relationship.targetId)) {
      nodes.set(relationship.targetId, { id: relationship.targetId, name: relationship.targetId, responsibility: "" });
    }
  }

  return { nodes: [...nodes.values()], relationships };
}

function parsePlanMermaidDiagram(mermaid: string, context: string, diagramTitle: string): {
  nodes: PlanDiagramNode[];
  relationships: Array<{ sourceId: string; targetId: string }>;
} {
  const nodes = new Map<string, PlanDiagramNode>();
  const relationships: Array<{ sourceId: string; targetId: string }> = [];
  const inferred = inferPlanDiagramLabels(context, diagramTitle);

  for (const line of mermaid.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("flowchart") || trimmed.startsWith("graph")) continue;

    for (const nodeMatch of trimmed.matchAll(/([A-Za-z0-9_:-]+)\s*\[\s*"?([^"\]]+)"?\s*\]/g)) {
      nodes.set(nodeMatch[1], {
        id: nodeMatch[1],
        ...parsePlanNodeLabel(nodeMatch[2], nodeMatch[1]),
      });
    }

    const relationshipMatch = /^([A-Za-z0-9_:-]+)(?:\s*\[[^\]]+\])?\s*-->(?:\|[^|]+\|)?\s*([A-Za-z0-9_:-]+)/.exec(trimmed);
    if (relationshipMatch) {
      relationships.push({ sourceId: relationshipMatch[1], targetId: relationshipMatch[2] });
      continue;
    }
  }

  const sourceIds = new Set(relationships.map((relationship) => relationship.sourceId));
  const targetIds = new Set(relationships.map((relationship) => relationship.targetId));
  const rootId = [...sourceIds].find((id) => !targetIds.has(id)) || relationships[0]?.sourceId || "";
  const childIds = relationships.filter((relationship) => relationship.sourceId === rootId).map((relationship) => relationship.targetId);

  for (const relationship of relationships) {
    if (!nodes.has(relationship.sourceId)) {
      nodes.set(relationship.sourceId, {
        id: relationship.sourceId,
        ...labelForPlanNode(relationship.sourceId, inferred, rootId, childIds),
      });
    }
    if (!nodes.has(relationship.targetId)) {
      nodes.set(relationship.targetId, {
        id: relationship.targetId,
        ...labelForPlanNode(relationship.targetId, inferred, rootId, childIds),
      });
    }
  }

  for (const node of nodes.values()) {
    if (isGenericPlanNode(node)) {
      const label = labelForPlanNode(node.id, inferred, rootId, childIds);
      node.title = label.title;
      node.target = label.target;
    }
  }

  if (relationships.length === 0) {
    return buildFallbackPlanDiagram(context, diagramTitle);
  }

  return { nodes: [...nodes.values()], relationships };
}

function buildFallbackPlanDiagram(context: string, diagramTitle: string): {
  nodes: PlanDiagramNode[];
  relationships: Array<{ sourceId: string; targetId: string }>;
} {
  const inferred = inferPlanDiagramLabels(context, diagramTitle);
  const cleanedTitle = normalizePlanTitle(inferred.cleanedTitle);

  if (/initiative relationship/i.test(diagramTitle)) {
    const nodes = inferred.initiatives.slice(0, 4).map((item, index) => ({
      id: `I${index + 1}`,
      ...planItemLabel(item),
    }));
    return {
      nodes,
      relationships: nodes.slice(1).map((node, index) => ({
        sourceId: index === 0 ? nodes[0].id : nodes[index].id,
        targetId: node.id,
      })),
    };
  }

  const initiative = inferred.initiatives.find((item) => normalizePlanTitle(item.title) === cleanedTitle)
    || inferred.initiatives.find((item) => cleanedTitle.includes(normalizePlanTitle(item.title)) || normalizePlanTitle(item.title).includes(cleanedTitle));
  if (initiative) {
    const children = inferred.epics.filter((item) => item.number.startsWith(`${initiative.number}.`));
    const nodes = [
      { id: "parent", ...planItemLabel(initiative) },
      ...children.map((item, index) => ({ id: `child${index + 1}`, ...planItemLabel(item) })),
    ];
    return {
      nodes,
      relationships: nodes.slice(1).map((node) => ({ sourceId: "parent", targetId: node.id })),
    };
  }

  const epic = inferred.epics.find((item) => normalizePlanTitle(item.title) === cleanedTitle)
    || inferred.epics.find((item) => cleanedTitle.includes(normalizePlanTitle(item.title)) || normalizePlanTitle(item.title).includes(cleanedTitle));
  if (epic) {
    const children = inferred.tickets.filter((item) => item.number.startsWith(`${epic.number}.`));
    const nodes = [
      { id: "parent", ...planItemLabel(epic) },
      ...children.map((item, index) => ({ id: `child${index + 1}`, ...planItemLabel(item) })),
    ];
    return {
      nodes,
      relationships: nodes.slice(1).map((node) => ({ sourceId: "parent", targetId: node.id })),
    };
  }

  return { nodes: [], relationships: [] };
}

function inferPlanDiagramLabels(context: string, diagramTitle: string) {
  const cleanedTitle = diagramTitle.replace(/\s+Diagram$/i, "").trim();
  const initiatives = extractNumberedPlanItems(context, "Initiative");
  const epics = extractNumberedPlanItems(context, "Epic");
  const tickets = extractNumberedPlanItems(context, "Ticket");
  const matchingInitiative = initiatives.find((item) => samePlanTitle(item.title, cleanedTitle));
  const matchingEpic = epics.find((item) => samePlanTitle(item.title, cleanedTitle));

  return { cleanedTitle, initiatives, epics, tickets, matchingInitiative, matchingEpic };
}

function labelForPlanNode(
  id: string,
  inferred: ReturnType<typeof inferPlanDiagramLabels>,
  rootId = "",
  childIds: string[] = [],
): { title: string; target: string } {
  if (id === rootId) {
    const rootItem = inferred.matchingEpic || inferred.matchingInitiative || inferred.initiatives[0];
    if (rootItem) return planItemLabel(rootItem);
  }

  const childIndex = childIds.indexOf(id);
  if (childIndex >= 0) {
    if (inferred.matchingEpic) {
      const scopedTickets = inferred.tickets.filter((item) => item.number.startsWith(`${inferred.matchingEpic?.number}.`));
      const item = scopedTickets[childIndex] || inferred.tickets[childIndex];
      if (item) return planItemLabel(item);
    }
    if (inferred.matchingInitiative) {
      const scopedEpics = inferred.epics.filter((item) => item.number.startsWith(`${inferred.matchingInitiative?.number}.`));
      const item = scopedEpics[childIndex] || inferred.epics[childIndex];
      if (item) return planItemLabel(item);
    }
    const overviewItem = inferred.initiatives[childIndex + (rootId ? 1 : 0)] || inferred.initiatives[childIndex];
    if (overviewItem) return planItemLabel(overviewItem);
  }

  const initiativeMatch = /^A?I?(\d+)$/i.exec(id);
  if (initiativeMatch) {
    const item = inferred.initiatives[Number(initiativeMatch[1]) - 1] || inferred.matchingInitiative;
    return item ? planItemLabel(item) : { title: inferred.cleanedTitle || humanizeMermaidId(id), target: "" };
  }

  const epicMatch = /^E(\d+)$|^I?(\d+)E(\d+)$/i.exec(id);
  if (epicMatch) {
    const epicNumber = Number(epicMatch[1] || epicMatch[3]);
    const matchingInitiative = inferred.matchingInitiative;
    const scopedEpics = matchingInitiative
      ? inferred.epics.filter((item) => item.number.startsWith(`${matchingInitiative.number}.`))
      : inferred.epics;
    const item = scopedEpics[epicNumber - 1] || inferred.epics[epicNumber - 1];
    return item ? planItemLabel(item) : { title: humanizeMermaidId(id), target: "" };
  }

  const ticketMatch = /^T(\d+)$|^I?(\d+)E(\d+)T(\d+)$/i.exec(id);
  if (ticketMatch) {
    const ticketNumber = Number(ticketMatch[1] || ticketMatch[4]);
    const matchingEpic = inferred.matchingEpic;
    const scopedTickets = matchingEpic
      ? inferred.tickets.filter((item) => item.number.startsWith(`${matchingEpic.number}.`))
      : inferred.tickets;
    const item = scopedTickets[ticketNumber - 1] || inferred.tickets[ticketNumber - 1];
    return item ? planItemLabel(item) : { title: humanizeMermaidId(id), target: "" };
  }

  return { title: humanizeMermaidId(id), target: "" };
}

function isGenericPlanNode(node: PlanDiagramNode) {
  return /^[A-Z]\d*$/i.test(node.title.trim()) || !node.target.trim();
}

function extractNumberedPlanItems(context: string, kind: "Initiative" | "Epic" | "Ticket") {
  const explicitPattern = new RegExp(`^\\s*(?:[-*]\\s*)?(?:#{3,5}\\s*)?(?:\\*\\*)?${kind}\\s+([\\d.]+)\\s*(?::|-|\\.|\\))\\s*(.+?)(?:\\*\\*)?\\s*$`, "gim");
  const matches = [...context.matchAll(explicitPattern)];
  if (matches.length === 0) {
    const section = sectionForPlanKind(context, kind);
    const numberedPattern = /^#{3,5}\s+([\d.]+)\s*(?::|-|\.|\))\s*(.+)$/gim;
    return [...section.matchAll(numberedPattern)]
      .filter((match) => numberMatchesPlanKind(match[1], kind))
      .map((match) => extractedNumberedPlanItem(section, match));
  }

  return matches.map((match) => extractedNumberedPlanItem(context, match));
}

function extractedNumberedPlanItem(context: string, match: RegExpMatchArray) {
    const start = match.index || 0;
    const nextHeading = context.slice(start + match[0].length).search(/^#{3,5}\s+|\n\s*(?:[-*]\s*)?(?:\*\*)?(?:Initiative|Epic|Ticket)\s+[\d.]+\s*(?::|-|\.|\))/m);
    const end = nextHeading === -1 ? context.length : start + match[0].length + nextHeading;
    const block = context.slice(start, end);
    const target = /(?:Goal|Target):\s*(.+)/i.exec(block)?.[1]?.trim() || "";
    return {
      number: match[1],
      title: match[2].trim(),
      target,
    };
}

function sectionForPlanKind(markdown: string, kind: "Initiative" | "Epic" | "Ticket") {
  const sectionTitle = kind === "Initiative" ? "Initiatives" : `${kind}s`;
  const pattern = new RegExp(`^##\\s+${sectionTitle}\\s*$`, "im");
  const match = pattern.exec(markdown);
  if (!match) return markdown;
  const start = match.index + match[0].length;
  const next = markdown.slice(start).search(/^##\s+/m);
  return markdown.slice(start, next === -1 ? markdown.length : start + next);
}

function numberMatchesPlanKind(number: string, kind: "Initiative" | "Epic" | "Ticket") {
  const depth = number.split(".").filter(Boolean).length;
  if (kind === "Initiative") return depth === 1;
  if (kind === "Epic") return depth === 2;
  return depth >= 3;
}

function planItemLabel(item: { title: string; target: string }) {
  return {
    title: item.title,
    target: item.target || "Define the outcome of this block of work.",
  };
}

function samePlanTitle(left: string, right: string) {
  return normalizePlanTitle(left) === normalizePlanTitle(right);
}

function normalizePlanTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parsePlanNodeLabel(rawLabel: string, fallback: string) {
  const label = rawLabel.replace(/<br\s*\/?>/gi, "\n").replace(/\\"/g, '"');
  const parts = label.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const targetLine = parts.find((part) => /^target:/i.test(part));
  return {
    title: parts[0] || humanizeMermaidId(fallback),
    target: targetLine?.replace(/^target:\s*/i, "") || parts.slice(1).join(" ") || "",
  };
}

function humanizeMermaidId(value: string) {
  return value.replace(/^I(\d+)E?(\d+)?T?(\d+)?$/i, (_match, initiative, epic, ticket) => {
    if (ticket) return `Ticket ${initiative}.${epic}.${ticket}`;
    if (epic) return `Epic ${initiative}.${epic}`;
    return `Initiative ${initiative}`;
  });
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

function parseRoute(pathname: string): { view: ViewKey; documentId: string | null } {
  const parts = pathname.split("/").filter(Boolean);
  const view = parts[2];
  if (view === "notes") return { view: "notes", documentId: null };
  if (view === "decisions") return { view: "decisions", documentId: null };
  if (view === "references") return { view: "references", documentId: null };
  if (view === "documents") return { view: "document", documentId: parts[3] || null };
  return { view: "context", documentId: null };
}

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function isReferenceFile(name: string) {
  const lowered = name.toLowerCase();
  return acceptedReferenceTypes.some((suffix) => lowered.endsWith(suffix));
}

function buildPlanPages(markdown: string): PlanPage[] {
  const pages: PlanPage[] = [];
  const majorSections = splitPlanMajorSections(markdown);

  for (const section of majorSections) {
    const parts = section.content.split(/```mermaid\s*([\s\S]*?)```/gi);
    const textParts: string[] = [];
    const diagramPages: PlanPage[] = [];

    for (let index = 0; index < parts.length; index += 1) {
      if (index % 2 === 0) {
        const text = parts[index].trim();
        if (text) textParts.push(text);
        continue;
      }

      const mermaid = parts[index].trim();
      if (mermaid) {
        diagramPages.push({
          id: `${section.id}-diagram-${index}`,
          title: section.title === "Plan Summary"
            ? "Initiative Relationship Diagram"
            : `${nearestPlanSubject(parts[index - 1] || section.title)} Diagram`,
          kind: "diagram",
          content: mermaid,
          context: `${section.content}\n\n${markdown}`,
        });
      }
    }

    const text = textParts.join("\n\n").trim();
    if (text) {
      pages.push({
        id: section.id,
        title: section.title,
        kind: "document",
        content: text,
      });
    }
    pages.push(...diagramPages);
  }

  return pages.length > 0
    ? pages
    : [{ id: "plan", title: "Plan", kind: "document", content: markdown.trim() || "No plan content yet." }];
}

function replacePlanPageMarkdown(markdown: string, page: PlanPage, nextContent: string) {
  if (page.kind !== "document") return markdown;
  const sections = splitPlanMajorSections(markdown);
  const section = sections.find((item) => item.title === page.title);
  if (!section) return markdown;

  const diagrams = [...section.content.matchAll(/```mermaid\s*[\s\S]*?```/gi)].map((match) => match[0].trim());
  const cleanedContent = sanitizePlanPageDraft(nextContent, page.title);
  const nextSection = [cleanedContent, ...diagrams].filter(Boolean).join("\n\n").trim();
  return `${markdown.slice(0, section.start)}${nextSection}${markdown.slice(section.end)}`;
}

function sanitizePlanPageDraft(value: string, title: string) {
  const withoutDiagrams = value.replace(/```mermaid\s*[\s\S]*?```/gi, "").trim();
  if (new RegExp(`^##\\s+${escapeRegExp(title)}\\s*$`, "im").test(withoutDiagrams)) {
    return withoutDiagrams;
  }
  return `## ${title}\n${withoutDiagrams}`.trim();
}

function splitPlanMajorSections(markdown: string) {
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) {
    return [{ id: "plan", title: firstMarkdownHeading(markdown) || "Plan", start: 0, end: markdown.length, content: markdown }];
  }

  return matches.map((match, index) => {
    const start = match.index || 0;
    const next = matches[index + 1]?.index ?? markdown.length;
    const title = match[1].trim();
    return {
      id: createStablePageId(title, index),
      title,
      start,
      end: next,
      content: markdown.slice(start, next).trim(),
    };
  });
}

function firstMarkdownHeading(markdown: string) {
  return /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() || null;
}

function nearestPlanSubject(text: string) {
  const headings = [...text.matchAll(/^#{3,4}\s+(.+)$/gm)];
  const heading = headings[headings.length - 1]?.[1]?.trim();
  return heading ? heading.replace(/^(Initiative|Epic|Ticket)\s+[\d.]+:\s*/i, "") : "Plan";
}

function createStablePageId(title: string, index: number) {
  return `${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page"}`;
}

function formatPlanTimecode(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function ensurePlanTimecode(markdown: string, timecode: string) {
  if (/^Timecode:/m.test(markdown)) return markdown;
  return markdown.replace(/^(#\s+.+)$/m, `$1\n\nTimecode: ${timecode}`);
}

function isPlanningSourceDocument(document: ProjectDocument | null, markdown: string) {
  if (!document) return false;
  if (document.type === "PRD") return true;
  if (document.type === "diagram" || document.type === "PLAN") return false;
  return /\brfc\b|request\s+for\s+comments/i.test(`${document.name}\n${markdown.slice(0, 1200)}`);
}

function createLocalId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "entity"}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueIds(ids: string[]) {
  return ids.filter((id, index) => id && ids.indexOf(id) === index);
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

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M3.5 4.5h9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6.2 4.5V3.2h3.6v1.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5 6.2 5.5 13h5L11 6.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
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

