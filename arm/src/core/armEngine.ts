import {
  AgentCard,
  AgentCardStatus,
  ChatNote,
  Decision,
  NewAgentCardInput,
  ProjectDocument,
  ProjectReference,
} from "./projectStore";

export type ReviewMode = "chat" | "product" | "technical" | "everything";

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

  const hasGoalLanguage = /\b(should|need|want|plan|build|launch|replace|improve|ship)\b/.test(lowered);
  const hasDecision = input.decisions.length > 0;
  const hasReferences = refsInPlay.length > 0;
  const contextLines = extractBullets(input.currentContext);

  if (hasGoalLanguage) {
    cards.push(card("question", "Clarify the target outcome", "Name the specific outcome this work should change so the next step can be judged.", "Add one sentence that defines success.", "Current direction", agentForMode(input.mode)));
  }

  if (!hasDecision) {
    cards.push(card("decision_candidate", "Capture a working decision", "The project has activity but no explicit decision recorded yet.", "Record the current best decision, even if it is provisional.", "Important decisions", agentForMode(input.mode)));
  }

  if (!hasReferences && input.mode !== "product") {
    cards.push(card("risk", "Reference gap", "There are no selected references supporting this thread of work, so review quality will stay shallow.", "Attach one or two source files or notes before the next review.", "Constraints", agentForMode(input.mode)));
  }

  if (input.mode === "product" || input.mode === "everything") {
    if (!containsAny(contextLines.join(" ").toLowerCase(), ["user", "customer", "audience"])) {
      cards.push(card("question", "Who is this for?", "The current context does not clearly identify the user or stakeholder affected by this work.", "Add the primary user and the job to be done.", "What this project is", "PM Agent"));
    }
    cards.push(card("action", "Trim the scope to one move", "Translate the prompt into one bounded next move instead of a broad ambition statement.", "Write one next action that can be completed in a day or less.", "Next actions", "Scope Agent"));
  }

  if (input.mode === "technical" || input.mode === "everything") {
    cards.push(card("risk", "Operational unknowns", "Call out the riskiest technical unknown before implementation work expands.", "Add one line for the main technical risk or dependency.", "Risks", "Engineer Agent"));
    if (input.activeDocument?.type === "PRD") {
      cards.push(card("question", "Implementation boundary", "The PRD should name what the first version explicitly excludes.", "Add one short non-goals section or scope cut.", "Requirements", "Engineer Agent"));
    }
  }

  if (refsInPlay.length > 0) {
    cards.push(card("action", "Pull reference signal into context", "Selected references should influence the living brief, not sit beside it.", "Fold the useful reference summaries into the current direction or constraints.", "Current direction", "Condenser Agent"));
  }

  if (cards.length === 0) {
    cards.push(card("question", "Pressure-test the prompt", "The input is too open-ended to generate a useful adversarial review yet.", "Rephrase it as a concrete decision or tradeoff.", "Open questions", agentForMode(input.mode)));
  }

  return dedupeCards(cards).slice(0, 5);
}

export function buildContextDraft(args: {
  projectName: string;
  currentContext: string;
  decisions: Decision[];
  cards: AgentCard[];
  references: ProjectReference[];
}) {
  const acceptedCards = args.cards.filter((card) => card.status === "accepted" || card.status === "edited");
  const selectedRefs = args.references.filter((item) => item.isSelected);

  const decisionLines = args.decisions.slice(0, 6).map((item) => item.text);
  const nextActionLines = acceptedCards
    .filter((card) => card.type === "action" || card.type === "scope_cut")
    .map((card) => card.proposedUpdate || card.body)
    .slice(0, 6);
  const riskLines = acceptedCards
    .filter((card) => card.type === "risk" || card.type === "contradiction")
    .map((card) => card.proposedUpdate || card.body)
    .slice(0, 6);
  const questionLines = acceptedCards
    .filter((card) => card.type === "question")
    .map((card) => card.proposedUpdate || card.body)
    .slice(0, 6);

  const directionLines = collapseUnique([
    ...decisionLines.slice(0, 3),
    ...acceptedCards
      .filter((card) => card.type === "decision_candidate" || card.type === "action")
      .map((card) => card.proposedUpdate || card.body)
      .slice(0, 4),
  ]);

  const referenceLines = selectedRefs
    .slice(0, 5)
    .map((item) => `${item.fileName}: ${item.summary || summarizeReferenceText(item.extractedText || "")}`);

  return ensureTrailingNewline(
    [
      "# Current Context",
      "",
      "## What this project is",
      bulletList(directionLines.length ? directionLines : [args.projectName]),
      "",
      "## Current direction",
      bulletList(directionLines.length ? directionLines : ["Clarify the current direction."]),
      "",
      "## Important decisions",
      bulletList(decisionLines.length ? decisionLines : ["No explicit decisions recorded yet."]),
      "",
      "## Constraints",
      bulletList(referenceLines.length ? referenceLines : ["No active reference constraints selected yet."]),
      "",
      "## Open questions",
      bulletList(questionLines.length ? questionLines : ["None captured yet."]),
      "",
      "## Risks",
      bulletList(riskLines.length ? riskLines : ["No material risks captured yet."]),
      "",
      "## Next actions",
      bulletList(nextActionLines.length ? nextActionLines : ["Choose the next bounded action."]),
    ].join("\n"),
  );
}

function agentForMode(mode: ReviewMode) {
  if (mode === "product") return "PM Agent";
  if (mode === "technical") return "Engineer Agent";
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

function collapseUnique(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function bulletList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function ensureTrailingNewline(value: string) {
  return `${value.replace(/[\r\n]+$/g, "")}\n`;
}
