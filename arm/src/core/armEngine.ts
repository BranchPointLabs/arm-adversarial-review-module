import {
  ChatNote,
  Decision,
  NewAgentCardInput,
  ProjectDocument,
  ProjectReference,
} from "./projectStore";

export type ReviewMode = "chat" | "product" | "technical" | "security" | "everything";

type ReviewInput = {
  prompt: string;
  mode: ReviewMode;
  activeDocument: ProjectDocument | null;
  currentContext: string;
  notes: ChatNote[];
  decisions: Decision[];
  references: ProjectReference[];
};

export function summarizeReferenceText(text: string) {
  const cleaned = normalizeText(text);
  if (!cleaned) return "No readable text extracted yet.";

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return cleaned.slice(0, 260);
  }

  return sentences.slice(0, 3).join(" ").slice(0, 360);
}

export function buildReviewCards(input: ReviewInput): NewAgentCardInput[] {
  const prompt = normalizeText(input.prompt);
  const lowered = prompt.toLowerCase();
  const refsInPlay = input.references.filter((item) => item.isSelected);
  const cards: NewAgentCardInput[] = [];

  if (input.mode === "chat") {
    return [];
  }

  const documentCards = buildDocumentAwareReviewCards(input);
  if (documentCards.length > 0) {
    return documentCards;
  }

  const hasGoalLanguage = /\b(should|need|want|plan|build|launch|replace|improve|ship)\b/.test(lowered);
  const hasDecision = input.decisions.length > 0;
  const hasReferences = refsInPlay.length > 0;
  const contextLines = extractBullets(input.currentContext);

  if (hasGoalLanguage) {
    cards.push(card("open_question", "Clarify the target outcome", "Name the specific outcome this work should change so the next step can be judged.", "Add one sentence that defines success.", "Current direction", agentForMode(input.mode)));
  }

  if (!hasDecision) {
    cards.push(card("action", "Capture a working decision", "The project has activity but no explicit decision recorded yet.", "Record the current best decision, even if it is provisional.", "Important decisions", agentForMode(input.mode)));
  }

  if (!hasReferences && input.mode !== "product") {
    cards.push(card("warning", "Reference gap", "There are no selected references supporting this thread of work, so review quality will stay shallow.", "Attach one or two source files or notes before the next review.", "Constraints", agentForMode(input.mode)));
  }

  if (input.mode === "product" || input.mode === "everything") {
    if (!containsAny(contextLines.join(" ").toLowerCase(), ["user", "customer", "audience"])) {
      cards.push(card("open_question", "Who is this for?", "The current context does not clearly identify the user or stakeholder affected by this work.", "Add the primary user and the job to be done.", "What this project is", "PM Agent"));
    }
    cards.push(card("action", "Trim the scope to one move", "Translate the prompt into one bounded next move instead of a broad ambition statement.", "Write one next action that can be completed in a day or less.", "Next actions", "Scope Agent"));
  }

  if (input.mode === "technical" || input.mode === "everything") {
    cards.push(card("warning", "Operational unknowns", "Call out the riskiest technical unknown before implementation work expands.", "Add one line for the main technical risk or dependency.", "Risks", "Engineer Agent"));
    if (input.activeDocument?.type === "PRD") {
      cards.push(card("open_question", "Implementation boundary", "The PRD should name what the first version explicitly excludes.", "Add one short non-goals section or scope cut.", "Requirements", "Engineer Agent"));
    }
  }

  if (input.mode === "security" || input.mode === "everything") {
    cards.push(card("warning", "Security boundary unclear", "Authentication, authorization, data handling, or retrieval boundaries are not explicit enough to evaluate safely.", "Add the key security boundary or missing control before implementation expands.", "Risks", "Security Agent"));
  }

  if (refsInPlay.length > 0) {
    cards.push(card("action", "Pull reference signal into context", "Selected references should influence the living brief, not sit beside it.", "Fold the useful reference summaries into the current direction or constraints.", "Current direction", "Condenser Agent"));
  }

  if (cards.length === 0) {
    cards.push(card("open_question", "Pressure-test the prompt", "The input is too open-ended to generate a useful adversarial review yet.", "Rephrase it as a concrete decision or tradeoff.", "Open questions", agentForMode(input.mode)));
  }

  return dedupeCards(cards).slice(0, 5);
}

function buildDocumentAwareReviewCards(input: ReviewInput): NewAgentCardInput[] {
  const document = input.activeDocument;
  const markdown = normalizeText(document?.markdown || "");
  if (!document || markdown.length < 300) return [];

  const lower = markdown.toLowerCase();
  const isPrd = document.type === "PRD" || /product requirements document|functional requirements|mvp definition/i.test(markdown);
  if (!isPrd) return [];

  if (input.mode === "product") {
    return dedupeCards([
      card(
        "warning",
        "Success is delivery-defined, not outcome-defined",
        "The PRD says the MVP is complete when auth, CRUD, drag-and-drop persistence, and deployment work, but it does not define what user behavior proves TaskFlow Lite is valuable after launch.",
        "Add one outcome metric, such as repeat task creation, return usage, or completed workflow rate, that can judge whether the Kanban task workflow is useful.",
        "MVP Definition",
        "PM Agent",
      ),
      card(
        "open_question",
        "Primary user is too broad for product tradeoffs",
        "The PRD lists developers, PMs, students, and solo task users; those groups will disagree about polish, learning value, onboarding, and workflow depth.",
        "Choose one primary MVP user and make the other audiences secondary so scope decisions have a clear tie-breaker.",
        "Target Users",
        "PM Agent",
      ),
      card(
        "action",
        "Define the minimum useful Kanban loop",
        "The core flow includes sign-in, task creation, editing, drag/drop, filtering, search, refresh persistence, and deployment; the review needs one explicit happy path that proves the product works end to end.",
        "Write the single MVP demo script from new user sign-in through creating, moving, filtering, and returning to persisted tasks.",
        "Core Workflow",
        "PM Agent",
      ),
      card(
        "warning",
        "Scope boundary is good but acceptance is uneven",
        "Out-of-scope items are clear, but several in-scope areas, especially dashboard and responsive behavior, are not tied to concrete acceptance checks.",
        "Add acceptance criteria for dashboard loading states, empty states, mobile column behavior, and edit/delete task recovery.",
        "Acceptance Criteria",
        "PM Agent",
      ),
    ]).slice(0, 4);
  }

  if (input.mode === "technical") {
    const backendChoice = containsAny(lower, ["firebase or supabase", "firestore or postgresql"]);
    return dedupeCards([
      card(
        "warning",
        backendChoice ? "Backend choice is unresolved" : "Persistence boundary needs a concrete decision",
        backendChoice
          ? "The architecture leaves Firebase versus Supabase and Firestore versus PostgreSQL open, which affects auth, authorization rules, realtime updates, deployment setup, and data modeling."
          : "The PRD requires persistence across sessions, but the implementation boundary for storage, auth, and sync is not yet explicit enough to estimate.",
        "Make one architecture decision before ticketing: choose the backend/auth/database combination and name the tradeoff it optimizes for.",
        "Technical Architecture",
        "Engineer Agent",
      ),
      card(
        "open_question",
        "Drag-and-drop persistence needs ordering rules",
        "The Task entity has status but no ordering field, so moving tasks between Kanban columns may not persist the visible order after refresh.",
        "Define whether task order matters in v1; if it does, add an order or rank requirement to the task model and acceptance criteria.",
        "Kanban Board",
        "Engineer Agent",
      ),
      card(
        "action",
        "Separate the build into testable vertical slices",
        "The PRD combines authentication, CRUD, board interactions, filtering/search, responsiveness, and deployment; each can be validated as an independent milestone.",
        "Break implementation into vertical slices: auth shell, task CRUD persistence, Kanban status movement, dashboard filtering/search, responsive/deploy readiness.",
        "MVP Definition",
        "Engineer Agent",
      ),
      card(
        "warning",
        "Non-functional requirements need measurable test hooks",
        "Initial load under 3 seconds and immediate board interactions are stated, but there is no environment, dataset size, or measurement method.",
        "Add the expected test context for performance checks, such as seeded task count, network assumptions, and how interaction latency will be judged.",
        "Non-Functional Requirements",
        "Engineer Agent",
      ),
    ]).slice(0, 4);
  }

  if (input.mode === "security") {
    return dedupeCards([
      card(
        "warning",
        "Authorization is implied by userId but not specified",
        "The Task model includes userId and protected routes are required, but the PRD does not state the rule that users can only read and mutate their own tasks.",
        "Add an authorization requirement that every task query and mutation is scoped to the authenticated user, including drag/drop status changes.",
        "Authentication",
        "Security Agent",
      ),
      card(
        "open_question",
        "Session handling is underspecified",
        "The PRD requires sessions to persist across refreshes and logout to work, but does not define expiration, token storage, password reset, or invalid session behavior.",
        "Add session acceptance checks for refresh, logout, expired sessions, and protected-route redirects.",
        "Authentication",
        "Security Agent",
      ),
      card(
        "warning",
        "Database security depends on the unresolved backend",
        "Firebase and Supabase require different access-control models; leaving the backend open also leaves row-level security or Firestore rules unreviewed.",
        "Once the backend is chosen, add explicit database access rules and a negative test that one user cannot access another user's task.",
        "Technical Architecture",
        "Security Agent",
      ),
      card(
        "action",
        "Define basic abuse and data handling boundaries",
        "Even a simple task app stores user-generated titles and descriptions, but the PRD does not mention input limits, deletion expectations, or logging of auth failures.",
        "Add lightweight security criteria for input length, task deletion behavior, auth failure handling, and whether deleted tasks are recoverable or permanently removed.",
        "Security Requirements",
        "Security Agent",
      ),
    ]).slice(0, 4);
  }

  return [];
}

function agentForMode(mode: ReviewMode) {
  if (mode === "product") return "PM Agent";
  if (mode === "technical") return "Engineer Agent";
  if (mode === "security") return "Security Agent";
  return "Critic Agent";
}

function card(
  type: NewAgentCardInput["type"],
  title: string,
  body: string,
  proposedUpdate: string,
  targetSection: string,
  sourceAgent: string,
): NewAgentCardInput {
  return { type, title, body, proposedUpdate, targetSection, sourceAgent };
}

function dedupeCards(cards: NewAgentCardInput[]) {
  const seen = new Set<string>();
  return cards.filter((item) => {
    const key = `${item.type}|${item.title}|${item.targetSection}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractBullets(markdown: string) {
  return normalizeText(markdown)
    .split("\n")
    .map((line) => line.replace(/^[-*#\s]+/, "").trim())
    .filter(Boolean);
}

function normalizeText(value: string) {
  return value.replace(/\r/g, "").trim();
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}
