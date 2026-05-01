import { getApiKey, loadLlmSettings } from "./llmSettings";
import { generalChatPersona, personaForMode } from "./reviewPersonas";
import {
  AgentCardType,
  ChatNote,
  Decision,
  NewAgentCardInput,
  ProjectDocument,
  ProjectReference,
} from "./projectStore";

type ProviderReviewMode = "product" | "technical";
export type ChatPersonaMode = "chat" | "product" | "technical";

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
            enum: ["info", "open_question", "action", "warning"],
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

export async function generateChatReplyWithLlm(input: {
  prompt: string;
  mode: ChatPersonaMode;
  activeDocument: ProjectDocument | null;
  currentContext: string;
  notes: ChatNote[];
  decisions: Decision[];
  references: ProjectReference[];
}) {
  const settings = loadLlmSettings();
  const apiKey = await getApiKey(settings.provider);
  if (!apiKey) {
    throw new Error(`No ${providerLabel(settings.provider)} API key saved.`);
  }

  const instructions =
    input.mode === "chat"
      ? generalChatPersona()
      : personaForMode(input.mode === "product" ? "product" : "technical");

  const payload = buildChatPayload(input);

  if (settings.provider === "openai") {
    return callOpenAiText(settings.modelByProvider.openai, apiKey, instructions, payload);
  }

  return callAnthropicText(settings.modelByProvider.anthropic, apiKey, instructions, payload);
}

export async function generateDocumentUpdateWithLlm(input: {
  mode: ChatPersonaMode;
  kind: "note" | "decision";
  updateText: string;
  activeDocument: ProjectDocument | null;
  currentContext: string;
  notes: ChatNote[];
  decisions: Decision[];
  references: ProjectReference[];
}) {
  const settings = loadLlmSettings();
  const apiKey = await getApiKey(settings.provider);
  if (!apiKey) {
    throw new Error(`No ${providerLabel(settings.provider)} API key saved.`);
  }

  const instructions =
    input.mode === "chat"
      ? generalChatPersona()
      : personaForMode(input.mode === "product" ? "product" : "technical");

  const payload = buildDocumentUpdatePayload(input);

  if (settings.provider === "openai") {
    return callOpenAiText(settings.modelByProvider.openai, apiKey, buildDocumentUpdateInstruction(instructions), payload);
  }

  return callAnthropicText(
    settings.modelByProvider.anthropic,
    apiKey,
    buildDocumentUpdateInstruction(instructions),
    payload,
  );
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
    "Only use these card types: info, open_question, action, warning.",
  ].join("\n");
}

function buildChatPayload(input: {
  prompt: string;
  mode: ChatPersonaMode;
  activeDocument: ProjectDocument | null;
  currentContext: string;
  notes: ChatNote[];
  decisions: Decision[];
  references: ProjectReference[];
}) {
  return JSON.stringify(
    {
      mode: input.mode,
      prompt: input.prompt,
      activeDocument: input.activeDocument
        ? {
            name: input.activeDocument.name,
            type: input.activeDocument.type,
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
        .slice(0, 6)
        .map((reference) => ({
          fileName: reference.fileName,
          summary: reference.summary,
        })),
      responseRules: [
        "Respond as a direct assistant reply to the user.",
        "Be concise.",
        "Use bullets only when they help.",
        "If the user is asking for evaluation, include a recommendation and next steps.",
      ],
    },
    null,
    2,
  );
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

function buildDocumentUpdateInstruction(basePersona: string) {
  return [
    basePersona,
    "",
    "You are updating a project's active context document.",
    "Return the full updated markdown document only.",
    "Do not use code fences.",
    "Preserve the existing structure when possible.",
    "Apply the requested update cleanly and minimally.",
    "If the update is a note, incorporate it as working context without overstating certainty.",
    "If the update is a decision, reflect it as an explicit decision in the document.",
  ].join("\n");
}

function buildDocumentUpdatePayload(input: {
  mode: ChatPersonaMode;
  kind: "note" | "decision";
  updateText: string;
  activeDocument: ProjectDocument | null;
  currentContext: string;
  notes: ChatNote[];
  decisions: Decision[];
  references: ProjectReference[];
}) {
  return JSON.stringify(
    {
      mode: input.mode,
      updateKind: input.kind,
      updateText: input.updateText,
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
        .slice(0, 6)
        .map((reference) => ({
          fileName: reference.fileName,
          summary: reference.summary,
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

async function callOpenAiText(model: string, apiKey: string, instructions: string, payload: string) {
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
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || "OpenAI request failed.");
  }

  return extractOpenAiText(result).trim();
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

async function callAnthropicText(model: string, apiKey: string, instructions: string, payload: string) {
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
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || "Anthropic request failed.");
  }

  return extractAnthropicText(result).trim();
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
    normalized === "info" ||
    normalized === "open_question" ||
    normalized === "action" ||
    normalized === "warning"
  ) {
    return normalized as AgentCardType;
  }
  if (normalized === "question") return "open_question";
  if (normalized === "risk" || normalized === "contradiction") return "warning";
  if (normalized === "decision_candidate" || normalized === "scope_cut") return "action";
  return "info";
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
