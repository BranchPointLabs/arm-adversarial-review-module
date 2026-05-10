import { NewAgentCardInput } from "./projectStore";

export type CardGenerationMode = "chat" | "product" | "technical" | "security";

export function normalizeGeneratedCards(cards: NewAgentCardInput[], mode: CardGenerationMode): NewAgentCardInput[] {
  return dedupeCards(cards.flatMap((card) => splitStructuredCardBody(card, mode)));
}

export function extractStructuredCardSections(text: string) {
  const normalized = text.replace(/\r/g, "").trim();
  const pattern = /(?:^|\n|\s-{3,}\s*)\s*(?:#{1,6}\s*)?(?:\*\*)?\s*CARD\s+\d+\s*:\s*([^*\n]+?)(?:\*\*)?\s*/gi;
  const matches = [...normalized.matchAll(pattern)];
  if (matches.length <= 1) return [];

  return matches.map((match, index) => {
    const start = (match.index || 0) + match[0].length;
    const end = matches[index + 1]?.index ?? normalized.length;
    return {
      title: cleanInlineMarkdown(match[1]),
      text: cleanCardBody(normalized.slice(start, end)),
    };
  }).filter((section) => section.text.length > 0 || section.title.length > 0);
}

export function dedupeCards(cards: NewAgentCardInput[]) {
  const seen = new Set<string>();
  return cards.filter((item) => {
    const key = `${item.type}|${item.title}|${item.body}|${item.sourceAgent}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitStructuredCardBody(card: NewAgentCardInput, mode: CardGenerationMode): NewAgentCardInput[] {
  const sections = extractStructuredCardSections(card.body);
  if (sections.length <= 1) return [card];

  return sections.map((section, index) => ({
    ...card,
    type: inferCardTypeFromText(section.text, card.type),
    title: section.title || `${card.title} ${index + 1}`,
    body: section.text,
    proposedUpdate: card.proposedUpdate,
    targetSection: card.targetSection,
    sourceAgent: card.sourceAgent || sourceAgentForMode(mode),
  }));
}

function cleanCardBody(value: string) {
  return cleanInlineMarkdown(
    value
      .replace(/^\s*[-\u2013\u2014]{3,}\s*/gm, "")
      .replace(/\b(Rejection reason|User consequence|Impact|Suggestion|Action|Question|Risk):/gi, "$1:")
      .trim(),
  );
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCardTypeFromText(text: string, fallback: NewAgentCardInput["type"]): NewAgentCardInput["type"] {
  const lower = text.toLowerCase();
  if (/\b(rejection reason|risk|warning|red flag|concern|danger)\b/.test(lower)) return "warning";
  if (/\b(question|unclear|unknown|missing)\b/.test(lower)) return "open_question";
  if (/\b(action|next step|recommendation|suggestion)\b/.test(lower)) return "action";
  return fallback;
}

function sourceAgentForMode(mode: CardGenerationMode) {
  if (mode === "product") return "CPO Agent";
  if (mode === "technical") return "Engineering Agent";
  if (mode === "security") return "Security Agent";
  return "ARM Assistant";
}
