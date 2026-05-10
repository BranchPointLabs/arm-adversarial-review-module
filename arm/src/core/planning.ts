import { AgentCard, ProjectDocument } from "./projectStore";

export type PlanStage = "setup" | "discovery" | "clarification" | "outline_review" | "final_generation";

export type PlanningModalCardType =
  | "question"
  | "assumption"
  | "constraint"
  | "risk"
  | "scope_cut"
  | "decision_candidate";

export type PlanningModalCard = {
  id: string;
  type: PlanningModalCardType;
  title: string;
  question?: string;
  body: string;
  why?: string;
  impact?: string;
  source: string;
  accepted: boolean;
  suggestedAnswers?: string[];
  selectedSuggestedAnswer?: string;
  answer?: string;
  customAnswer: string;
  skipped: boolean;
};

export type PlanQuestion = {
  id: string;
  question: string;
  why: string;
  impact: string;
  source: string;
  answer: string;
  skipped: boolean;
};

export function buildPlanningCards(
  documents: ProjectDocument[],
  acceptedCards: AgentCard[],
  context: string,
): PlanningModalCard[] {
  const primaryDocument = documents[0];
  const cardSource = acceptedCards[0];
  const contextProvided = context.trim().length > 0;
  const docNames = documents.map((document) => document.name).filter(Boolean);
  const warningCard = acceptedCards.find((card) => card.type === "warning");
  const actionCard = acceptedCards.find((card) => card.type === "action");

  return [
    {
      id: "outcome",
      type: "question",
      title: "Outcome target",
      question: "What exact user or business outcome should this plan achieve?",
      body: "The final plan needs a decision-driving outcome before it can break work into initiatives.",
      why: cardSource
        ? `Linked to critique: ${cardSource.title}`
        : "The plan needs a decision target, not just a list of work.",
      impact: "Without this, initiatives can become generic work items instead of decision-driving steps.",
      source: cardSource ? `${cardSource.sourceAgent}: ${cardSource.title}` : primaryDocument?.name || "Selected documents",
      accepted: true,
      suggestedAnswers: suggestedAnswers([
        cardSource ? `Resolve the critique: ${cardSource.title}` : "",
        primaryDocument ? `Deliver the outcome described in ${primaryDocument.name}` : "",
        docNames.length > 1 ? `Align ${docNames.slice(0, 3).join(", ")} into one delivery path` : "",
      ]),
      answer: "",
      customAnswer: "",
      skipped: false,
    },
    {
      id: "constraint",
      type: "question",
      title: "Hard constraint",
      question: contextProvided ? "Which constraint must this plan obey no matter what?" : "What time, budget, team, or technical constraint should shape this plan?",
      body: "Constraints keep the outline from expanding into a plan that is too large or irrelevant.",
      why: "Constraints make the plan specific to this situation.",
      impact: "Without a constraint, the plan may recommend work that is too large, too slow, or irrelevant.",
      source: contextProvided ? "User context" : primaryDocument?.name || "Selected documents",
      accepted: true,
      suggestedAnswers: suggestedAnswers([
        contextProvided ? context.trim().split(/\n+/)[0] : "",
        "Keep the first delivery pass small enough to validate quickly.",
        "Avoid implementation commitments until success criteria are clear.",
      ]),
      answer: "",
      customAnswer: "",
      skipped: false,
    },
    {
      id: "signal",
      type: "question",
      title: "Decision signal",
      question: "What measurable result will tell you to proceed, iterate, or kill this plan?",
      body: "The plan needs a measurable gate so execution changes a decision instead of creating open-ended work.",
      why: "ARM needs a decision gate so the plan does not become open-ended activity.",
      impact: "Without a signal, the plan can be completed without changing the decision.",
      source: acceptedCards.length > 0 ? "Accepted cards" : "Selected documents",
      accepted: true,
      suggestedAnswers: suggestedAnswers([
        "Proceed only if the core user workflow can be validated end to end.",
        "Iterate if feedback identifies unresolved usability or scope gaps.",
        "Kill or pause if the plan cannot produce a clear decision signal within the constraint.",
      ]),
      answer: "",
      customAnswer: "",
      skipped: false,
    },
    {
      id: "assumption-source-truth",
      type: "assumption",
      title: "Source documents are authoritative",
      body: `Treat ${docNames.length > 0 ? docNames.slice(0, 3).join(", ") : "the selected documents"} as the planning source of truth unless the user's context overrides them.`,
      source: "Selected documents",
      accepted: true,
      customAnswer: "",
      skipped: false,
    },
    {
      id: "constraint-context",
      type: "constraint",
      title: contextProvided ? "Use supplied planning context" : "Keep planning context explicit",
      body: contextProvided
        ? context.trim()
        : "No extra user context was supplied. Keep plan language explicit about assumptions and validation.",
      source: contextProvided ? "User context" : "Planning setup",
      accepted: true,
      customAnswer: "",
      skipped: false,
    },
    {
      id: "risk-validation",
      type: "risk",
      title: warningCard ? `Risk from review: ${warningCard.title}` : "Validation gap risk",
      body: warningCard?.body || "The source material may not identify enough validation detail to decide whether the plan worked.",
      source: warningCard ? `${warningCard.sourceAgent}: ${warningCard.title}` : "Planning discovery",
      accepted: true,
      customAnswer: "",
      skipped: false,
    },
    {
      id: "scope-cut-first-pass",
      type: "scope_cut",
      title: "Defer implementation detail",
      body: "Keep the plan at outcome, requirement, and validation level. Defer code structure, routes, schemas, and library decisions unless a source document explicitly requires them.",
      source: "ARM planning rule",
      accepted: true,
      customAnswer: "",
      skipped: false,
    },
    {
      id: "decision-candidate",
      type: "decision_candidate",
      title: actionCard ? `Candidate decision: ${actionCard.title}` : "Candidate decision gate",
      body: actionCard?.proposedUpdate || actionCard?.body || "Use the final plan to decide whether to proceed, iterate, or stop based on the measurable signal.",
      source: actionCard ? `${actionCard.sourceAgent}: ${actionCard.title}` : "Planning discovery",
      accepted: true,
      customAnswer: "",
      skipped: false,
    },
  ];
}

export function planningQuestionsFromCards(cards: PlanningModalCard[]): PlanQuestion[] {
  return cards
    .filter((card) => card.type === "question")
    .map((card) => ({
      id: card.id,
      question: card.question || questionTextForCard(card),
      why: card.why || `Planning card: ${card.title}`,
      impact: card.impact || card.body,
      source: card.source,
      answer: resolvedQuestionAnswer(card),
      skipped: card.skipped,
    }));
}

export function planningQuestionCardsComplete(cards: PlanningModalCard[]) {
  return cards
    .filter((card) => card.type === "question")
    .every((card) => card.skipped || resolvedQuestionAnswer(card).trim().length > 0);
}

export function resolvedQuestionAnswer(card: PlanningModalCard) {
  return card.customAnswer.trim() || card.selectedSuggestedAnswer?.trim() || "";
}

export function buildPlanOutlineDraft(input: {
  documents: ProjectDocument[];
  acceptedCards: AgentCard[];
  planningCards: PlanningModalCard[];
  context: string;
}) {
  const questionAnswers = input.planningCards
    .filter((card) => card.type === "question")
    .map((card) => `- ${card.title}: ${card.skipped ? "Skipped; ARM should make the safest explicit assumption." : resolvedQuestionAnswer(card)}`);
  const acceptedPlanningCards = input.planningCards.filter((card) => card.type !== "question" && card.accepted);
  const acceptedReviewCards = input.acceptedCards.slice(0, 6).map((card) => `- ${card.sourceAgent}: ${card.title}`);
  const sourceList = input.documents.map((document) => `- ${document.type}: ${document.name}`);

  return [
    "## Draft Plan Outline",
    "",
    "### Source Documents",
    ...withFallback(sourceList, "- No selected source documents."),
    "",
    "### Planning Context",
    input.context.trim() || "No extra planning context supplied.",
    "",
    "### Clarification Answers",
    ...withFallback(questionAnswers, "- No clarification answers supplied."),
    "",
    "### Modal Planning Inputs",
    ...withFallback(acceptedPlanningCards.map((card) => `- ${labelForCardType(card.type)}: ${card.title} — ${card.body}`), "- No modal planning cards accepted."),
    "",
    "### Accepted Review Signals",
    ...withFallback(acceptedReviewCards, "- No accepted review cards available."),
    "",
    "### Outline Direction",
    "- Convert the selected source material into implementation-independent initiatives.",
    "- Preserve accepted constraints and scope cuts as boundaries.",
    "- Tie epics and tickets to validation criteria and the decision signal.",
  ].join("\n");
}

export function buildEnrichedPlanningContext(input: {
  context: string;
  planningCards: PlanningModalCard[];
  outline: string;
}) {
  const questions = input.planningCards.filter((card) => card.type === "question");
  const accepted = input.planningCards.filter((card) => card.type !== "question" && card.accepted);
  return [
    input.context.trim(),
    "Modal-local planning discovery:",
    "",
    "Question answers:",
    ...withFallback(
      questions.map((card) => `- ${card.title}: ${card.skipped ? "Skipped; make the safest explicit assumption." : resolvedQuestionAnswer(card)}`),
      "- None.",
    ),
    "",
    "Accepted assumptions, constraints, risks, scope cuts, and decision candidates:",
    ...withFallback(
      accepted.map((card) => `- ${labelForCardType(card.type)}: ${card.title} — ${card.body}`),
      "- None.",
    ),
    "",
    "Edited plan outline:",
    input.outline.trim() || "No edited outline supplied.",
  ]
    .filter((line, index) => index > 0 || line.trim().length > 0)
    .join("\n");
}

function questionTextForCard(card: PlanningModalCard) {
  if (card.id === "outcome") return "What exact user or business outcome should this plan achieve?";
  if (card.id === "constraint") return "Which constraint must this plan obey no matter what?";
  if (card.id === "signal") return "What measurable result will tell you to proceed, iterate, or kill this plan?";
  return card.title;
}

function suggestedAnswers(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, 3);
}

function withFallback(values: string[], fallback: string) {
  return values.length > 0 ? values : [fallback];
}

function labelForCardType(type: PlanningModalCardType) {
  return type.replace("_", " ");
}
