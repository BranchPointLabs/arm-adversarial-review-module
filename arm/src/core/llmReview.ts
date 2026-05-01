import { getApiKey, loadLlmSettings } from "./llmSettings";
import { personaForMode } from "./reviewPersonas";
import {
  AgentCardType,
  ChatNote,
  Decision,
  NewAgentCardInput,
  ProjectDocument,
  ProjectReference,
} from "./projectStore";

type ProviderReviewMode = "product" | "technical";

type ReviewRequest = {
  prompt: string;
  mode: ProviderReviewMode;
  activeDocument: ProjectDocument | null;
  currentContext: string;
  notes: ChatNote[];
  decisions: Decision[];
  references: ProjectReference[];
};

const cardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title", "body", "proposedUpdate", "targetSection"],
        properties: {
          type: {
            type: "string",
            enum: ["question", "action", "risk", "decision_candidate", "scope_cut", "contradiction"],
          },
          title: { type: "string" },
          body: { type: "string" },
          proposedUpdate: { type: ["string", "null"] },
          targetSection: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

export async function generateReviewCardsWithLlm(input: ReviewRequest): Promise<NewAgentCardInput[]> {
  const settings = loadLlmSettings();
  const apiKey = await getApiKey(settings.provider);
  if (!apiKey) {
    throw new Error(`No ${providerLabel(settings.provider)} API key saved.`);
  }

  const instruction = buildInstruction(input.mode);
  const payload = buildReviewPayload(input);

  if (settings.provider === "openai") {
    return callOpenAi(settings.modelByProvider.openai, apiKey, instruction, payload, sourceAgentForMode(input.mode));
  }

  return callAnthropic(settings.modelByProvider.anthropic, apiKey, instruction, payload, sourceAgentForMode(input.mode));
}

function buildInstruction(mode: ProviderReviewMode) {
  return [
    personaForMode(mode),
    "",
    "Return JSON only.",
    "Output at most 5 cards.",
    "Each card must be concise and actionable.",
    "Do not repeat the artifact back to the user.",
    "Do not produce summary prose outside the JSON schema.",
    "Use targetSection values that fit the living context document, such as 'What this project is', 'Current direction', 'Important decisions', 'Constraints', 'Open questions', or 'Risks'.",
  ].join("\n");
}

function buildReviewPayload(input: ReviewRequest) {
  return JSON.stringify(
    {
      reviewMode: input.mode,
      prompt: input.prompt,
      activeDocument: input.activeDocument
        ? {
            name: input.activeDocument.name,
            type: input.activeDocument.type,
            markdown: input.activeDocument.markdown,
          }
        : null,
      currentContext: input.currentContext,
      recentNotes: input.notes.slice(0, 8).map((note) => note.text),
      recentDecisions: input.decisions.slice(0, 8).map((decision) => ({
        text: decision.text,
        reason: decision.reason,
      })),
      selectedReferences: input.references
        .filter((reference) => reference.isSelected)
        .slice(0, 8)
        .map((reference) => ({
          fileName: reference.fileName,
          summary: reference.summary,
          extractedText: (reference.extractedText || "").slice(0, 3000) || null,
        })),
    },
    null,
    2,
  );
}

async function callOpenAi(model: string, apiKey: string, instructions: string, payload: string, sourceAgent: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input: payload,
      max_output_tokens: 1400,
      text: {
        format: {
          type: "json_schema",
          name: "arm_review_cards",
          schema: cardSchema,
          strict: true,
        },
      },
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || "OpenAI request failed.");
  }

  const text = extractOpenAiText(result);
  return normalizeCards(JSON.parse(text).cards || [], sourceAgent);
}

async function callAnthropic(model: string, apiKey: string, instructions: string, payload: string, sourceAgent: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1400,
      system: instructions,
      messages: [{ role: "user", content: payload }],
      output_config: {
        format: {
          type: "json_schema",
          schema: cardSchema,
        },
      },
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || "Anthropic request failed.");
  }

  const text = extractAnthropicText(result);
  return normalizeCards(JSON.parse(text).cards || [], sourceAgent);
}

function extractOpenAiText(result: any): string {
  const output = Array.isArray(result?.output) ? result.output : [];
  const parts: string[] = [];

  for (const item of output) {
    if (item?.type !== "message") continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const block of content) {
      if (block?.type === "output_text" && typeof block.text === "string") {
        parts.push(block.text);
      }
    }
  }

  if (parts.length === 0) {
    throw new Error("OpenAI returned no parseable text.");
  }

  return parts.join("\n");
}

function extractAnthropicText(result: any): string {
  const content = Array.isArray(result?.content) ? result.content : [];
  const parts = content
    .filter((block: any) => block?.type === "text" && typeof block.text === "string")
    .map((block: any) => block.text as string);

  if (parts.length === 0) {
    throw new Error("Anthropic returned no parseable text.");
  }

  return parts.join("\n");
}

function normalizeCards(cards: any[], sourceAgent: string): NewAgentCardInput[] {
  return cards
    .map((card) => ({
      type: normalizeCardType(card?.type),
      title: normalizeString(card?.title),
      body: normalizeString(card?.body),
      proposedUpdate: normalizeOptionalString(card?.proposedUpdate),
      targetSection: normalizeOptionalString(card?.targetSection),
      sourceAgent,
    }))
    .filter((card) => card.type && card.title && card.body)
    .slice(0, 5) as NewAgentCardInput[];
}

function normalizeCardType(value: unknown): AgentCardType {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    normalized === "question" ||
    normalized === "action" ||
    normalized === "risk" ||
    normalized === "decision_candidate" ||
    normalized === "scope_cut" ||
    normalized === "contradiction"
  ) {
    return normalized as AgentCardType;
  }
  return "question";
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalString(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function providerLabel(provider: "openai" | "anthropic") {
  return provider === "openai" ? "OpenAI" : "Anthropic";
}

function sourceAgentForMode(mode: ProviderReviewMode) {
  return mode === "product" ? "CPO Agent" : "Engineering Agent";
}
