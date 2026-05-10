import { AgentCard, NewAgentCardInput, ProjectDocument, ReviewDialogueTurn, ReviewSession } from "./projectStore";

export function buildScrumReviewArtifact(
  document: ProjectDocument,
  productCards: NewAgentCardInput[],
  technicalCards: NewAgentCardInput[],
  securityCards: NewAgentCardInput[],
  createdCards: AgentCard[],
) {
  const product = productCards.slice(0, 2);
  const technical = technicalCards.slice(0, 2);
  const security = securityCards.slice(0, 2);
  const rawTurns: ReviewDialogueTurn[] = [
    {
      speaker: "Host",
      segment: "Intro",
      text: limitSpeechText(`Today we are reviewing ${document.name}. ARM will keep this to structured Product, Technical, and Security findings.`),
    },
    {
      speaker: "Product",
      segment: "Product pass",
      text: summarizeCardsForSpeech(product, "Product found no major business, user, or scope blocker."),
    },
    {
      speaker: "Technical",
      segment: "Technical pass",
      text: summarizeCardsForSpeech(technical, "Technical found no major architecture, implementation, or operational blocker."),
    },
    {
      speaker: "Security",
      segment: "Security pass",
      text: summarizeCardsForSpeech(security, "Security found no major privacy, compliance, abuse, or retrieval-risk blocker."),
    },
    {
      speaker: "Host",
      segment: "Conflict/tradeoff section",
      text: buildTradeoffSpeech(product, technical, security),
    },
    {
      speaker: "Host",
      segment: "Final recommendations",
      text: buildRecommendationSpeech(createdCards),
    },
    {
      speaker: "Host",
      segment: "Card extraction summary",
      text: limitSpeechText(
        `ARM created ${createdCards.length} review cards from the structured persona findings. The transcript is playback only; the cards remain the source of truth.`,
      ),
    },
  ];
  const turns = rawTurns.filter((turn) => turn.text.trim()).slice(0, 10);

  return {
    title: `Scrum Review: ${document.name}`,
    turns,
    transcript: renderReviewTranscript(turns, createdCards),
  };
}

export function reviewSessionTurns(session: ReviewSession | null): ReviewDialogueTurn[] {
  if (!session) return [];
  try {
    const parsed = JSON.parse(session.dialogueTurns);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((turn): turn is ReviewDialogueTurn => {
        return Boolean(turn && typeof turn.speaker === "string" && typeof turn.segment === "string" && typeof turn.text === "string");
      })
      .slice(0, 10);
  } catch {
    return [];
  }
}

function summarizeCardsForSpeech(cards: NewAgentCardInput[], fallback: string) {
  if (cards.length === 0) return fallback;
  return limitSpeechText(cards.map(cardToReviewLine).join(" "));
}

function cardToReviewLine(card: NewAgentCardInput) {
  const prefix = card.type === "warning" ? "Risk" : card.type === "open_question" ? "Question" : card.type === "action" ? "Action" : "Signal";
  return `${prefix}: ${card.title}. ${card.body}`;
}

function buildTradeoffSpeech(
  productCards: NewAgentCardInput[],
  technicalCards: NewAgentCardInput[],
  securityCards: NewAgentCardInput[],
) {
  const productRisk = productCards.find((card) => card.type === "warning" || card.type === "open_question");
  const technicalRisk = technicalCards.find((card) => card.type === "warning" || card.type === "open_question");
  const securityRisk = securityCards.find((card) => card.type === "warning" || card.type === "open_question");
  const signals = [productRisk, technicalRisk, securityRisk].filter((card): card is NewAgentCardInput => Boolean(card));
  if (signals.length === 0) {
    return "The review did not produce a clear conflict. The next step is to execute the extracted cards in priority order.";
  }
  return limitSpeechText(`The main tradeoff is between ${signals.map((card) => card.title).join(", ")}. Resolve those before treating the document as ready.`);
}

function buildRecommendationSpeech(cards: AgentCard[]) {
  const actions = cards.filter((card) => card.type === "action").slice(0, 2);
  if (actions.length > 0) {
    return limitSpeechText(`Start with ${actions.map((card) => card.title).join(" and ")}. Those actions give the team the clearest next review checkpoint.`);
  }
  const firstCards = cards.slice(0, 2);
  if (firstCards.length > 0) {
    return limitSpeechText(`Start by resolving ${firstCards.map((card) => card.title).join(" and ")}. Those are the clearest review outputs.`);
  }
  return "No final recommendation was created because no structured cards were available.";
}

function renderReviewTranscript(turns: ReviewDialogueTurn[], cards: AgentCard[]) {
  const transcript = turns.map((turn) => `## ${turn.segment}\n**${turn.speaker}:** ${turn.text}`).join("\n\n");
  const cardSummary = cards.map((card) => `- ${formatCardType(card.type)}: ${card.title}`).join("\n");
  return `${transcript}\n\n## Extracted Cards\n${cardSummary || "- No cards created."}\n`;
}

function limitSpeechText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 280) return normalized;
  const clipped = normalized.slice(0, 277);
  return `${clipped.slice(0, Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf(" "), 180)).trim()}...`;
}

function formatCardType(value: string) {
  if (value === "open_question") return "Question";
  return value.replace("_", " ");
}
