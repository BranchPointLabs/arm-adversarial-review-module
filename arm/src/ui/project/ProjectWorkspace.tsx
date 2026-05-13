import React from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { dedupeCards, extractStructuredCardSections, normalizeGeneratedCards } from "../../core/cardGeneration";
import {
  ChatPersonaMode,
  generateChatCardsWithLlm,
  generateDocumentUpdateWithLlm,
  generatePlanWithLlm,
  generateReviewCardsWithLlm,
} from "../../core/llmReview";
import {
  buildEnrichedPlanningContext,
  buildPlanOutlineDraft,
  buildPlanningCards,
  planningQuestionCardsComplete,
  planningQuestionsFromCards,
  PlanningModalCard,
  PlanStage,
} from "../../core/planning";
import { buildScrumReviewArtifact, reviewSessionTurns } from "../../core/reviewSession";
import { safeSpeechCancel, safeSpeechPause, safeSpeechResume, safeSpeechSpeak } from "../../core/speech";
import {
  AgentCard,
  ChatNote,
  Decision,
  DiagramEntity,
  NewAgentCardInput,
  ProjectDocument,
  ProjectReference,
  ReviewDialogueTurn,
  ReviewSession,
  projectStore,
} from "../../core/projectStore";
import Modal from "../shared/Modal";
import AddDocumentModal from "./AddDocumentModal";
import { buildSidebarItems, CardFilter } from "./cardSidebar";
import PlanningModal from "./PlanningModal";
import ProjectCenterPane from "./ProjectCenterPane";
import ReviewRail from "./ReviewRail";
import ReviewSessionModal from "./ReviewSessionModal";
import WorkspaceSidebar from "./WorkspaceSidebar";
import { useDocumentWorkflow } from "./useDocumentWorkflow";
import { acceptedReferenceTypes, useReferenceWorkflow } from "./useReferenceWorkflow";

type ViewKey = "context" | "notes" | "decisions" | "references" | "document";
type ChatMode = "chat" | "product" | "technical" | "security";
type ReviewTarget = ChatMode | "allPersonas";
type ResolveKind = "patch" | "decision" | "open_question";
type DiagramMode = "diagram" | "code";

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
  const [documentMarkdownEditing, setDocumentMarkdownEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [submitBusy, setSubmitBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [errorModalMessage, setErrorModalMessage] = React.useState<string | null>(null);

  const [prompt, setPrompt] = React.useState("");
  const [chatMode, setChatMode] = React.useState<ChatMode>("chat");
  const [allReviewMode, setAllReviewMode] = React.useState(false);
  const [cardFilter, setCardFilter] = React.useState<CardFilter>("info");
  const [showAllCards, setShowAllCards] = React.useState(false);
  const [showDismissedCards, setShowDismissedCards] = React.useState(false);

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
  const [planningModalCards, setPlanningModalCards] = React.useState<PlanningModalCard[]>([]);
  const [planOutline, setPlanOutline] = React.useState("");
  const [planStatus, setPlanStatus] = React.useState<string | null>(null);
  const [planGenerating, setPlanGenerating] = React.useState(false);
  const [activePlanPageIndex, setActivePlanPageIndex] = React.useState(0);
  const [reviewSessionOpen, setReviewSessionOpen] = React.useState(false);
  const [reviewSession, setReviewSession] = React.useState<ReviewSession | null>(null);
  const [reviewSessionCards, setReviewSessionCards] = React.useState<AgentCard[]>([]);
  const [reviewGenerating, setReviewGenerating] = React.useState(false);
  const [reviewPlaybackState, setReviewPlaybackState] = React.useState<"idle" | "playing" | "paused">("idle");

  const filesInputRef = React.useRef<HTMLInputElement | null>(null);
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);
  const draggingRightRail = React.useRef(false);
  const speechTurnIndexRef = React.useRef(0);
  const speechTurnsRef = React.useRef<ReviewDialogueTurn[]>([]);
  const repairedStructuredCardIdsRef = React.useRef<Set<string>>(new Set());
  const autosaveTimerRef = React.useRef<number | null>(null);
  const autosavingDocumentIdRef = React.useRef<string | null>(null);

  const route = parseRoute(location.pathname);
  const currentView = route.view;
  const routeDocumentId = route.documentId;
  const activeContextMarkdown = activeDocument ? documentMarkdown : "";
  const stickyNotes = notes.filter(isStickyNote);
  const sidebarItems = buildSidebarItems(cards, cardFilter, showAllCards, showDismissedCards);
  const sourceDocuments = documents.filter((document) => document.type !== "PLAN");
  const planDocuments = documents.filter((document) => document.type === "PLAN");
  const rightRailOpen = rightRailWidth >= 220;
  const referenceWorkflow = useReferenceWorkflow({ projectPath, setBusy, setStatus, refreshAll });
  const documentWorkflow = useDocumentWorkflow({
    projectPath,
    activeDocument,
    documentMarkdown,
    setBusy,
    setStatus,
    setErrorModalMessage,
    setActiveDocument,
    setDocumentMarkdown,
    setDocumentMarkdownEditing,
    setActivePlanPageIndex,
    setDiagramMermaidDraft,
    setDiagramCodeEditing,
    setPlanGenerating,
    refreshAll,
    navigate,
  });

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
    const preserveDraft = nextDocument?.id && autosavingDocumentIdRef.current === nextDocument.id;
    setActiveDocument(nextDocument);
    if (!preserveDraft) {
      setDocumentMarkdown(nextDocument?.markdown || "");
      setDocumentMarkdownEditing(false);
    }
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
    if (!projectPath || !activeDocument || activeDocument.type === "diagram") return;
    if (documentMarkdown === activeDocument.markdown) return;

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    const documentId = activeDocument.id;
    const documentType = activeDocument.type;
    const nextMarkdown = documentMarkdown;
    autosaveTimerRef.current = window.setTimeout(() => {
      autosavingDocumentIdRef.current = documentId;
      void projectStore
        .saveDocument(projectPath, documentId, nextMarkdown)
        .then(() => {
          setDocuments((current) =>
            current.map((document) =>
              document.id === documentId ? { ...document, markdown: nextMarkdown, updatedAt: new Date().toISOString() } : document,
            ),
          );
          setActiveDocument((current) =>
            current?.id === documentId ? { ...current, markdown: nextMarkdown, updatedAt: new Date().toISOString() } : current,
          );
          setStatus(documentType === "PLAN" ? "Plan autosaved." : "Document autosaved.");
        })
        .catch((error: any) => {
          setStatus(typeof error === "string" ? error : error?.message || "Autosave failed.");
        })
        .finally(() => {
          autosavingDocumentIdRef.current = null;
        });
    }, 700);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [activeDocument, documentMarkdown, projectPath]);

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

  React.useEffect(() => {
    return () => {
      safeSpeechCancel();
    };
  }, []);

  React.useEffect(() => {
    if (!projectPath || cards.length === 0) return;
    const brokenCard = cards.find((card) => {
      if (card.status === "rejected" || repairedStructuredCardIdsRef.current.has(card.id)) return false;
      return extractStructuredCardSections(card.body).length > 1;
    });
    if (!brokenCard) return;

    repairedStructuredCardIdsRef.current.add(brokenCard.id);
    void repairStructuredCard(brokenCard);
  }, [cards, projectPath]);

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

  function resetPlanningModalState() {
    setPlanContext("");
    setPlanningModalCards([]);
    setPlanOutline("");
    setPlanStage("setup");
    setPlanStatus(null);
    setPlanGenerating(false);
  }

  function openPlanning() {
    const initialIds = activeDocument ? [activeDocument.id] : sourceDocuments.slice(0, 1).map((document) => document.id);
    setPlanSelectedDocIds(initialIds);
    resetPlanningModalState();
    setPlanOpen(true);
  }

  function rerunPlan(document: ProjectDocument) {
    setPlanSelectedDocIds(sourceDocuments.slice(0, 3).map((item) => item.id));
    resetPlanningModalState();
    setPlanContext(`Re-plan from existing plan: ${document.name}`);
    setPlanOpen(true);
  }

  function togglePlanSource(documentId: string) {
    setPlanSelectedDocIds((current) =>
      current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId],
    );
  }

  function startPlanningDiscovery() {
    const selected = getSelectedPlanDocuments();
    if (selected.length === 0) {
      setPlanStatus("Select at least one source document.");
      return;
    }
    setPlanningModalCards(buildPlanningCards(selected, getPlanningCards(), planContext));
    setPlanOutline("");
    setPlanStage("discovery");
    setPlanStatus(null);
  }

  function continueFromDiscovery() {
    const hasQuestions = planningModalCards.some((card) => card.type === "question");
    if (hasQuestions) {
      setPlanStage("clarification");
      setPlanStatus(null);
      return;
    }
    buildOutlineForReview();
  }

  function buildOutlineForReview() {
    const selected = getSelectedPlanDocuments();
    setPlanOutline(
      buildPlanOutlineDraft({
        documents: selected,
        acceptedCards: getPlanningCards(),
        planningCards: planningModalCards,
        context: planContext,
      }),
    );
    setPlanStage("outline_review");
    setPlanStatus(null);
  }

  function goBackInPlanning() {
    if (planStage === "discovery") setPlanStage("setup");
    if (planStage === "clarification") setPlanStage("discovery");
    if (planStage === "outline_review") {
      setPlanStage(planningModalCards.some((card) => card.type === "question") ? "clarification" : "discovery");
    }
  }

  function updatePlanningCard(cardId: string, update: (card: PlanningModalCard) => PlanningModalCard) {
    setPlanningModalCards((current) => current.map((card) => (card.id === cardId ? update(card) : card)));
  }

  async function createPlanFromAnswers() {
    const selected = getSelectedPlanDocuments();
    if (selected.length === 0) {
      setPlanStatus("Select at least one source document.");
      return;
    }
    if (!planningQuestionCardsComplete(planningModalCards)) {
      setPlanStatus("Answer each question or choose Skip for the ones you want ARM to assume.");
      return;
    }

    setBusy(true);
    setPlanGenerating(true);
    setPlanStage("final_generation");
    try {
      const planTimecode = formatPlanTimecode(new Date());
      const planName = `${selected[0]?.name || projectName} Plan ${planTimecode}`;
      const planningCards = getPlanningCards();
      const enrichedContext = buildEnrichedPlanningContext({
        context: planContext,
        planningCards: planningModalCards,
        outline: planOutline,
      });
      const markdown = ensurePlanTimecode(
        await generatePlanWithLlm({
          title: planName,
          documents: selected,
          cards: planningCards,
          context: enrichedContext,
          questions: planningQuestionsFromCards(planningModalCards),
        }),
        planTimecode,
      );
      const plan = await projectStore.createDocument(projectPath, planName, "PLAN");
      await projectStore.saveDocument(projectPath, plan.id, markdown);
      setPlanOpen(false);
      setPlanStage("setup");
      setPlanningModalCards([]);
      setPlanOutline("");
      await refreshAll();
      navigate(`/p/${encodeURIComponent(projectPath)}/documents/${plan.id}`);
      setStatus("Plan generated.");
    } catch (error: any) {
      setPlanStatus(typeof error === "string" ? error : error?.message || "Plan creation failed.");
      setPlanStage("outline_review");
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
    const effectiveMode = effectiveChatMode(chatMode, allReviewMode);

    setSubmitBusy(true);
    try {
      await projectStore.addChatNote(projectPath, text, ["chat", "user", effectiveMode]);
      if (effectiveMode === "chat") {
        const newCards = await generateChatCards(text, "chat");
        await projectStore.createAgentCards(projectPath, sourceAgentLabel(effectiveMode), newCards);
        setStatus(newCards.length > 1 ? "Chat cards added." : "Chat card added.");
        setCardFilter(firstVisibleCardFilter(newCards));
      } else {
        const newCards = await buildCardsForPrompt(text, effectiveMode);
        await projectStore.createAgentCards(projectPath, sourceAgentLabel(effectiveMode), newCards);
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

  async function buildCardsForPrompt(text: string, effectiveMode: Exclude<ReviewTarget, "chat">) {
    if (effectiveMode === "product" || effectiveMode === "technical" || effectiveMode === "security") {
      return normalizeGeneratedCards(await generateReviewCardsWithMode(text, effectiveMode), effectiveMode).slice(0, 5);
    }

    const [productCards, technicalCards, securityCards] = await Promise.all([
      generateReviewCardsWithMode(text, "product"),
      generateReviewCardsWithMode(text, "technical"),
      generateReviewCardsWithMode(text, "security"),
    ]);
    const cards = dedupeCards([
      ...normalizeGeneratedCards(productCards, "product"),
      ...normalizeGeneratedCards(technicalCards, "technical"),
      ...normalizeGeneratedCards(securityCards, "security"),
    ]);
    if (cards.length === 0) {
      throw new Error("No persona review cards were generated.");
    }
    return cards.slice(0, 12);
  }

  async function generateReviewCardsWithMode(text: string, mode: "product" | "technical" | "security") {
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

  async function generateScrumReviewAudioNow() {
    const sourceDocument = activeDocument;
    if (!sourceDocument) {
      setErrorModalMessage("Select a document or plan before generating a Scrum review.");
      return;
    }

    const reviewPrompt = [
      `Generate concise structured review cards for a Scrum review of "${sourceDocument.name}".`,
      "Focus on the active document and retrieved supporting context.",
      "Return high-signal risks, open questions, actions, and useful facts only.",
    ].join("\n");

    setReviewSessionOpen(true);
    setReviewSession(null);
    setReviewSessionCards([]);
    setReviewGenerating(true);
    setReviewPlaybackState("idle");
    safeSpeechCancel();

    try {
      const [productCards, technicalCards, securityCards] = await Promise.all([
        generateReviewCardsWithMode(reviewPrompt, "product"),
        generateReviewCardsWithMode(reviewPrompt, "technical"),
        generateReviewCardsWithMode(reviewPrompt, "security"),
      ]);
      const proposedCards = dedupeCards([...productCards, ...technicalCards, ...securityCards]).slice(0, 11);

      if (proposedCards.length === 0) {
        throw new Error("No review cards were generated.");
      }

      const createdCards = await projectStore.createAgentCards(projectPath, "Scrum Review", proposedCards);
      const artifact = buildScrumReviewArtifact(sourceDocument, productCards, technicalCards, securityCards, createdCards);
      const session = await projectStore.createScrumReviewSession(projectPath, {
        sourceDocumentId: sourceDocument.id,
        sourceDocumentTitle: sourceDocument.name,
        title: artifact.title,
        status: "completed",
        transcript: artifact.transcript,
        dialogueTurns: JSON.stringify(artifact.turns),
        cardIds: JSON.stringify(createdCards.map((card) => card.id)),
      });
      setReviewSession(session);
      setReviewSessionCards(createdCards);
      setCardFilter(firstVisibleCardFilter(createdCards));
      await refreshAll();
    } catch (error: any) {
      setErrorModalMessage(typeof error === "string" ? error : error?.message || "Scrum review generation failed.");
    } finally {
      setReviewGenerating(false);
    }
  }

  function playReviewSession() {
    const turns = reviewSessionTurns(reviewSession);
    if (turns.length === 0) return;
    if (reviewPlaybackState === "paused") {
      safeSpeechResume();
      setReviewPlaybackState("playing");
      return;
    }
    safeSpeechCancel();
    speechTurnIndexRef.current = 0;
    speechTurnsRef.current = turns;
    setReviewPlaybackState("playing");
    speakNextReviewTurn();
  }

  function pauseReviewSession() {
    safeSpeechPause();
    setReviewPlaybackState("paused");
  }

  function restartReviewSession() {
    safeSpeechCancel();
    setReviewPlaybackState("idle");
    speechTurnIndexRef.current = 0;
    setTimeout(() => playReviewSession(), 0);
  }

  function speakNextReviewTurn() {
    const turns = speechTurnsRef.current;
    const index = speechTurnIndexRef.current;
    if (index >= turns.length) {
      setReviewPlaybackState("idle");
      return;
    }
    const turn = turns[index];
    speechTurnIndexRef.current = index + 1;
    const utterance = new SpeechSynthesisUtterance(`${turn.speaker}. ${turn.text}`);
    utterance.rate = 1.02;
    utterance.pitch = turn.speaker === "Host" ? 1 : 0.95;
    utterance.onend = () => speakNextReviewTurn();
    utterance.onerror = () => setReviewPlaybackState("idle");
    if (!safeSpeechSpeak(utterance)) {
      setReviewPlaybackState("idle");
      setErrorModalMessage("Speech playback is not available in this desktop webview, but the review transcript and cards were saved.");
    }
  }

  async function generateChatCards(text: string, mode: ChatPersonaMode): Promise<NewAgentCardInput[]> {
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
    return normalizeGeneratedCards(cards, mode).slice(0, 3);
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

    if (allReviewMode) {
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
      mode: chatMode,
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

  async function clearVisibleCards() {
    const cardsToClear = sidebarItems.map((item) => item.card).filter((card) => card.status !== "rejected");
    if (cardsToClear.length === 0) return;

    setBusy(true);
    try {
      await Promise.all(cardsToClear.map((card) => projectStore.updateAgentCard(projectPath, card.id, { status: "rejected" })));
      await refreshAll();
      setStatus(cardsToClear.length === 1 ? "Card cleared." : `${cardsToClear.length} cards cleared.`);
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Clear failed.");
    } finally {
      setBusy(false);
    }
  }

  async function repairStructuredCard(card: AgentCard) {
    const splitCards = normalizeGeneratedCards([card], "chat");
    if (splitCards.length <= 1) return;

    try {
      await projectStore.createAgentCards(projectPath, card.sourceAgent || "ARM Assistant", splitCards);
      await projectStore.updateAgentCard(projectPath, card.id, { status: "rejected" });
      await refreshAll();
      setStatus(`${splitCards.length} cards split from one generated response.`);
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Card split failed.");
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
      await projectStore.updateAgentCard(projectPath, resolveCard.id, { status: "resolved" });
      setResolveCard(null);
      setResolveText("");
      setResolveStatus(null);
      await refreshAll();
      setStatus("Card resolved.");
    } catch (error: any) {
      setResolveStatus(typeof error === "string" ? error : error?.message || "Resolve failed.");
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
      <WorkspaceSidebar
        navCollapsed={navCollapsed}
        projectName={projectName}
        projectPath={projectPath}
        currentView={currentView}
        routeDocumentId={routeDocumentId}
        activeDocument={activeDocument}
        sourceDocuments={sourceDocuments}
        planDocuments={planDocuments}
        references={references}
        decisions={decisions}
        stickyNotes={stickyNotes}
        busy={busy}
        onToggleCollapsed={() => setNavCollapsed((value) => !value)}
        onNavigate={navigate}
        onAddDocument={() => documentWorkflow.setAddDocumentOpen(true)}
        onDeleteDiagram={(document) => void documentWorkflow.deleteDiagramNow(document)}
        onDeletePrd={(document) => void documentWorkflow.deletePrdNow(document)}
        onDeletePlan={(document) => void documentWorkflow.deletePlanNow(document)}
      />

      <section className="focusPane workspaceFocus">
        <ProjectCenterPane
          currentView={currentView}
          activeDocument={activeDocument}
          notes={{ notes, onUseChatMode: () => setChatMode("chat") }}
          decisions={{ decisions, onOpenUpdate: () => setUpdateOpen(true) }}
          references={{
            references,
            repositoryPanelOpen: referenceWorkflow.repositoryPanelOpen,
            repositoryInput: referenceWorkflow.repositoryInput,
            repositoryProcessing: referenceWorkflow.repositoryProcessing,
            repositoryStatus: referenceWorkflow.repositoryStatus,
            filesInputRef,
            folderInputRef,
            onRepositoryPanelOpenChange: referenceWorkflow.setRepositoryPanelOpen,
            onRepositoryInputChange: referenceWorkflow.setRepositoryInput,
            onProcessRepository: () => void referenceWorkflow.processRepositoryReferenceNow(),
            onPickedFiles: (files) => void referenceWorkflow.handlePickedFiles(files),
            onToggleReference: (reference) => void referenceWorkflow.toggleReference(reference),
            onSummarizeReference: (reference) => void referenceWorkflow.summarizeReference(reference),
            onRemoveReference: (reference) => void referenceWorkflow.removeReference(reference),
          }}
          diagram={{
            mode: diagramMode,
            mermaidDraft: diagramMermaidDraft,
            codeEditing: diagramCodeEditing,
            busy,
            status,
            onModeChange: setDiagramMode,
            onDraftChange: setDiagramMermaidDraft,
            onCodeEditingChange: setDiagramCodeEditing,
            onSaveCode: () => void saveDiagramCodeNow(),
            onOpenAddCard: openAddDiagramCard,
          }}
          plan={{
            markdown: documentMarkdown,
            activePageIndex: activePlanPageIndex,
            busy,
            reviewGenerating,
            onActivePageChange: setActivePlanPageIndex,
            onSavePage: documentWorkflow.savePlanPageNow,
            onDelete: (document) => void documentWorkflow.deletePlanNow(document),
            onRerun: rerunPlan,
            onGenerateScrumReview: () => void generateScrumReviewAudioNow(),
            onCopy: () => void documentWorkflow.copyDocumentNow(),
          }}
          markdownDocument={{
            document: activeDocument,
            markdown: documentMarkdown,
            editing: documentMarkdownEditing,
            busy,
            reviewGenerating,
            sourceDocumentCount: sourceDocuments.length,
            onOpenUpdate: () => setUpdateOpen(true),
            onGenerateScrumReview: () => void generateScrumReviewAudioNow(),
            onOpenPlanning: openPlanning,
            onMarkdownChange: setDocumentMarkdown,
            onEditingChange: setDocumentMarkdownEditing,
            onCopy: () => void documentWorkflow.copyDocumentNow(),
            isPlanningSourceDocument,
          }}
          context={{
            document: activeDocument,
            markdown: documentMarkdown,
            busy,
            status,
            sourceDocumentCount: sourceDocuments.length,
            onOpenUpdate: () => setUpdateOpen(true),
            onOpenPlanning: openPlanning,
            onMarkdownChange: setDocumentMarkdown,
            onCopy: () => void documentWorkflow.copyDocumentNow(),
          }}
        />
      </section>

      <ReviewRail
        open={rightRailOpen}
        cards={cards}
        sidebarItems={sidebarItems}
        cardFilter={cardFilter}
        showAllCards={showAllCards}
        showDismissedCards={showDismissedCards}
        chatMode={chatMode}
        allReviewMode={allReviewMode}
        prompt={prompt}
        busy={busy}
        submitBusy={submitBusy}
        onResizeStart={(event) => {
          draggingRightRail.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onOpen={() => setRightRailWidth(420)}
        onCardFilterChange={setCardFilter}
        onShowAllCardsChange={setShowAllCards}
        onShowDismissedCardsChange={setShowDismissedCards}
        onClearVisibleCards={() => void clearVisibleCards()}
        onPromptChange={setPrompt}
        onSubmitPrompt={() => void submitPrompt()}
        onChatModeChange={setChatMode}
        onAllReviewModeChange={setAllReviewMode}
        onAcceptCard={openResolveCard}
        onDismissCard={(card) => void setCardStatus(card, "rejected")}
      />

      <input
        ref={filesInputRef}
        type="file"
        accept={acceptedReferenceTypes.join(",")}
        multiple
        hidden
        onChange={(event) => void referenceWorkflow.handlePickedFiles(event.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        hidden
        multiple
        {...({ webkitdirectory: "true", directory: "true" } as any)}
        onChange={(event) => void referenceWorkflow.handlePickedFiles(event.target.files)}
      />

      {documentWorkflow.addDocumentOpen ? (
        <AddDocumentModal
          busy={busy}
          name={documentWorkflow.newDocumentName}
          kind={documentWorkflow.newDocumentKind}
          type={documentWorkflow.newDocumentType}
          status={documentWorkflow.newDocumentStatus}
          onClose={() => documentWorkflow.setAddDocumentOpen(false)}
          onCreate={documentWorkflow.createDocument}
          onNameChange={documentWorkflow.setNewDocumentName}
          onKindChange={documentWorkflow.setNewDocumentKind}
          onTypeChange={documentWorkflow.setNewDocumentType}
        />
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
        <PlanningModal
          busy={busy}
          planStage={planStage}
          selectedDocIds={planSelectedDocIds}
          sourceDocuments={sourceDocuments}
          planContext={planContext}
          planningCards={planningModalCards}
          planOutline={planOutline}
          planStatus={planStatus}
          onClose={() => setPlanOpen(false)}
          onBack={goBackInPlanning}
          onStart={startPlanningDiscovery}
          onDiscoveryContinue={continueFromDiscovery}
          onClarificationContinue={buildOutlineForReview}
          onFinalGenerate={() => void createPlanFromAnswers()}
          onToggleSource={togglePlanSource}
          onContextChange={setPlanContext}
          onCardAcceptedChange={(cardId, accepted) => updatePlanningCard(cardId, (card) => ({ ...card, accepted }))}
          onQuestionSuggestedAnswer={(cardId, answer) =>
            updatePlanningCard(cardId, (card) => ({ ...card, selectedSuggestedAnswer: answer, customAnswer: "", skipped: false }))
          }
          onQuestionCustomAnswer={(cardId, answer) =>
            updatePlanningCard(cardId, (card) => ({ ...card, customAnswer: answer, selectedSuggestedAnswer: undefined, skipped: false }))
          }
          onQuestionSkippedChange={(cardId, skipped) =>
            updatePlanningCard(cardId, (card) => ({
              ...card,
              skipped,
              customAnswer: skipped ? "" : card.customAnswer,
              selectedSuggestedAnswer: skipped ? undefined : card.selectedSuggestedAnswer,
            }))
          }
          onOutlineChange={setPlanOutline}
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

      {reviewSessionOpen ? (
        <ReviewSessionModal
          reviewGenerating={reviewGenerating}
          reviewSession={reviewSession}
          reviewSessionCards={reviewSessionCards}
          playbackState={reviewPlaybackState}
          onClose={() => {
            safeSpeechCancel();
            setReviewPlaybackState("idle");
            setReviewSessionOpen(false);
          }}
          onPlayPause={reviewPlaybackState === "playing" ? pauseReviewSession : playReviewSession}
          onRestart={restartReviewSession}
        />
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

function formatPlanTimecode(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function ensurePlanTimecode(markdown: string, timecode: string) {
  if (/^(?:\*\*)?Timecode(?::|\*\*:)/m.test(markdown)) return markdown;
  return markdown.replace(/^(#\s+.+)$/m, `$1\n\n**Timecode:** ${timecode}`);
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

function effectiveChatMode(mode: ChatMode, allReview: boolean): ReviewTarget {
  return allReview ? "allPersonas" : mode;
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


function isStickyNote(note: ChatNote) {
  return Array.isArray(note.tags) && note.tags.includes("note");
}

function sourceAgentLabel(mode: ReviewTarget) {
  if (mode === "product") return "CPO Agent";
  if (mode === "technical") return "Engineering Agent";
  if (mode === "security") return "Security Agent";
  if (mode === "allPersonas") return "Combined Review";
  return "ARM Assistant";
}


