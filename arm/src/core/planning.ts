import { AgentCard, ProjectDocument } from "./projectStore";

export type PlanMode = "focused" | "kill";
export type PlanStage = "setup" | "interrogation";

export type PlanQuestion = {
  id: string;
  question: string;
  why: string;
  impact: string;
  source: string;
  answer: string;
  skipped: boolean;
};

export function buildPlanQuestions(
  documents: ProjectDocument[],
  acceptedCards: AgentCard[],
  context: string,
  mode: PlanMode,
): PlanQuestion[] {
  const primaryDocument = documents[0];
  const cardSource = acceptedCards[0];
  const contextProvided = context.trim().length > 0;

  return [
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
}

export function buildPlanMarkdown(args: {
  title: string;
  mode: PlanMode;
  documents: ProjectDocument[];
  cards: AgentCard[];
  context: string;
  questions: PlanQuestion[];
}) {
  const answered = args.questions.map((question) => ({
    ...question,
    finalAnswer: question.skipped ? defaultAnswerForQuestion(question.id, args.mode) : question.answer.trim(),
  }));

  const initiativeSeeds =
    args.cards.length > 0
      ? args.cards.slice(0, 3).map((card) => ({
          source: `${card.sourceAgent}: ${card.title}`,
          why: card.body,
          action: card.proposedUpdate || card.body,
        }))
      : args.documents.slice(0, 3).map((document) => ({
          source: `${document.type}: ${document.name}`,
          why: firstMeaningfulLine(document.markdown) || "Selected as a planning source.",
          action:
            args.mode === "kill"
              ? "Run the smallest test that could disprove this direction."
              : "Turn the strongest source signal into one bounded next step.",
        }));

  const initiatives = initiativeSeeds.slice(0, 3).map((seed, index) => {
    const constraint = answered.find((question) => question.id === "constraint")?.finalAnswer || "Keep scope small.";
    const signal = answered.find((question) => question.id === "signal")?.finalAnswer || "Use the result to decide proceed, iterate, or kill.";
    const action = args.mode === "kill" ? `Try to invalidate this direction: ${seed.action}` : seed.action;

    return [
      `## Initiative ${index + 1}`,
      `Source: ${seed.source}`,
      `Why: ${trimSentence(seed.why)}`,
      `Action: ${trimSentence(action)} Constraint: ${trimSentence(constraint)}`,
      `Success Signal: ${trimSentence(signal)}`,
      "",
    ].join("\n");
  });

  return ensureTrailingNewline(
    [
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
    ].join("\n"),
  );
}

function defaultAnswerForQuestion(id: string, mode: PlanMode) {
  if (id === "outcome") {
    return mode === "kill" ? "Assume the goal is to find the cheapest invalidating signal." : "Assume the goal is to reduce the largest planning risk.";
  }
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
