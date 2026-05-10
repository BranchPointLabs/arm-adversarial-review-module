import { AgentCard, ProjectDocument } from "./projectStore";

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
): PlanQuestion[] {
  const primaryDocument = documents[0];
  const cardSource = acceptedCards[0];
  const contextProvided = context.trim().length > 0;

  return [
    {
      id: "outcome",
      question: "What exact user or business outcome should this plan achieve?",
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
      question: contextProvided ? "Which constraint must this plan obey no matter what?" : "What time, budget, team, or technical constraint should shape this plan?",
      why: "Constraints make the plan specific to this situation.",
      impact: "Without a constraint, the plan may recommend work that is too large, too slow, or irrelevant.",
      source: contextProvided ? "User context" : primaryDocument?.name || "Selected documents",
      answer: "",
      skipped: false,
    },
    {
      id: "signal",
      question: "What measurable result will tell you to proceed, iterate, or kill this plan?",
      why: "ARM needs a decision gate so the plan does not become open-ended activity.",
      impact: "Without a signal, the plan can be completed without changing the decision.",
      source: acceptedCards.length > 0 ? "Accepted cards" : "Selected documents",
      answer: "",
      skipped: false,
    },
  ];
}
