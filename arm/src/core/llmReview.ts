import { getApiKey, loadLlmSettings } from "./llmSettings";
import { projectStore } from "./projectStore";
import { generalChatPersona, personaForMode } from "./reviewPersonas";
import {
  AgentCardType,
  ChatNote,
  Decision,
  NewAgentCardInput,
  ProjectDocument,
  ProjectReference,
  RetrievedMemoryChunk,
} from "./projectStore";

type ProviderReviewMode = "product" | "technical";
export type ChatPersonaMode = "chat" | "product" | "technical";

type ReviewRequest = {
  projectPath: string;
  prompt: string;
  mode: ProviderReviewMode;
  activeDocument: ProjectDocument | null;
  currentContext: string;
  notes: ChatNote[];
  decisions: Decision[];
  references: ProjectReference[];
};

type CardResponseSchema = typeof cardSchema | typeof chatCardSchema;

const cardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title", "body", "proposedUpdate", "targetSection", "sourceDocumentTitle", "sourceSectionTitle"],
        properties: {
          type: {
            type: "string",
            enum: ["info", "open_question", "action", "warning"],
          },
          title: { type: "string" },
          body: { type: "string" },
          proposedUpdate: { type: ["string", "null"] },
          targetSection: { type: ["string", "null"] },
          sourceDocumentTitle: { type: ["string", "null"] },
          sourceSectionTitle: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

const chatCardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title", "body", "proposedUpdate", "targetSection", "sourceDocumentTitle", "sourceSectionTitle"],
        properties: {
          type: {
            type: "string",
            enum: ["info", "open_question", "action", "warning"],
          },
          title: { type: "string" },
          body: { type: "string" },
          proposedUpdate: { type: ["string", "null"] },
          targetSection: { type: ["string", "null"] },
          sourceDocumentTitle: { type: ["string", "null"] },
          sourceSectionTitle: { type: ["string", "null"] },
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
  const retrievedContext = await retrieveMemoryContext(input);
  logRetrievedContext(input.mode, retrievedContext);
  const payload = buildReviewPayload(input, retrievedContext);

  if (settings.provider === "openai") {
    const cards = await callOpenAi(settings.modelByProvider.openai, apiKey, instruction, payload, sourceAgentForMode(input.mode));
    logCardSources(cards);
    return cards;
  }

  const cards = await callAnthropic(settings.modelByProvider.anthropic, apiKey, instruction, payload, sourceAgentForMode(input.mode));
  logCardSources(cards);
  return cards;
}

export async function generateChatCardsWithLlm(input: {
  projectPath: string;
  prompt: string;
  mode: ChatPersonaMode;
  activeDocument: ProjectDocument | null;
  currentContext: string;
  notes: ChatNote[];
  decisions: Decision[];
  references: ProjectReference[];
}): Promise<NewAgentCardInput[]> {
  const settings = loadLlmSettings();
  const apiKey = await getApiKey(settings.provider);
  if (!apiKey) {
    throw new Error(`No ${providerLabel(settings.provider)} API key saved.`);
  }

  const instruction = buildChatCardInstruction(input.mode);
  const payload = buildChatPayload(input);
  const sourceAgent = chatSourceAgentForMode(input.mode);

  if (settings.provider === "openai") {
    return callOpenAi(settings.modelByProvider.openai, apiKey, instruction, payload, sourceAgent, chatCardSchema);
  }

  return callAnthropic(settings.modelByProvider.anthropic, apiKey, instruction, payload, sourceAgent, chatCardSchema);
}

export async function generateChatReplyWithLlm(input: {
  projectPath: string;
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

  const instructions = buildChatInstruction(input.mode);

  const payload = buildChatPayload(input);

  if (settings.provider === "openai") {
    return callOpenAiText(settings.modelByProvider.openai, apiKey, instructions, payload);
  }

  return callAnthropicText(settings.modelByProvider.anthropic, apiKey, instructions, payload);
}

export async function generateDocumentUpdateWithLlm(input: {
  projectPath: string;
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
    "Output 3 to 5 cards.",
    "Prefer 4 cards when the prompt has enough substance.",
    "Each card must be concise and actionable.",
    "Do not repeat the artifact back to the user.",
    "Do not produce summary prose outside the JSON schema.",
    "Use targetSection values that fit the living context document, such as 'What this project is', 'Current direction', 'Important decisions', 'Constraints', 'Open questions', or 'Risks'.",
    "Only use these card types: info, open_question, action, warning.",
    "For product and technical reviews, include a useful mix of card types. Do not return only info cards.",
    "When possible include: one info card, one warning card, one open_question card, and one action card.",
    "Retrieved context is supporting evidence only. Do not treat it as automatic truth.",
    "Use retrieved context to identify contradictions, surface risks, ask better questions, and propose decisions.",
    "If a card materially relies on retrieved context, set sourceDocumentTitle and sourceSectionTitle from the supporting snippet.",
    "If a card does not rely on retrieved context, set sourceDocumentTitle and sourceSectionTitle to null.",
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
        "Do not return JSON.",
        "Do not create a tiny generic answer.",
        "Ground the response in the active document and the user's prompt.",
        "If the user is asking for evaluation, include a recommendation, the reasoning, and concrete next steps.",
        "Use short sections or bullets when that makes the answer easier to scan.",
      ],
    },
    null,
    2,
  );
}

function buildChatInstruction(mode: ChatPersonaMode) {
  if (mode === "chat") {
    return [
      generalChatPersona(),
      "",
      "Give a useful answer that is specific to the active document.",
      "If the user asks a simple factual question, answer directly.",
      "If the user asks for judgment or evaluation, include: answer, reasoning, and next steps.",
    ].join("\n");
  }

  const label = mode === "product" ? "product/CEO" : "engineering";
  return [
    personaForMode(mode),
    "",
    `You are answering in ${label} persona chat mode, not generating review-card JSON.`,
    "Give a substantive but compact answer.",
    "Be specific to the active document and the user's question.",
    "Include a clear recommendation when the prompt asks for judgment.",
    "Include 2-5 concrete next steps when useful.",
    "Do not just say the idea needs validation. Explain what to validate, why, and what decision it unlocks.",
  ].join("\n");
}

function buildChatCardInstruction(mode: ChatPersonaMode) {
  const basePersona = mode === "chat" ? generalChatPersona() : personaForMode(mode);
  return [
    basePersona,
    "",
    "Return JSON only.",
    "Output 1 to 3 cards.",
    "Use only these card types: info, open_question, action, warning.",
    "Use info for direct answers, conclusions, or useful context.",
    "Use warning for risks, red flags, or reasons to pause.",
    "Use open_question for unanswered questions the user should resolve.",
    "Use action for concrete next steps.",
    "Do not put the full response into one generic info card when the answer naturally contains warnings, questions, or next steps.",
    "Each card should be useful by itself and grounded in the active document and prompt.",
    "For a simple factual chat, one info card is enough.",
    "For an evaluative chat, prefer 2 or 3 mixed cards.",
  ].join("\n");
}

function buildReviewPayload(input: ReviewRequest, retrievedContext: RetrievedMemoryChunk[]) {
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
      retrievedContext: retrievedContext.map((chunk) => ({
        source: chunk.sectionTitle ? `${chunk.documentTitle} > ${chunk.sectionTitle}` : chunk.documentTitle,
        documentTitle: chunk.documentTitle,
        sectionTitle: chunk.sectionTitle,
        text: chunk.text,
        similarity: Number(chunk.similarity.toFixed(4)),
      })),
      retrievalRules: [
        "Retrieved context is supporting evidence only.",
        "Do not assume retrieved content is correct without validation.",
        "Do not rewrite the document directly.",
        "Use retrieved content to improve review quality, not to replace the active document.",
      ],
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

async function callOpenAi(
  model: string,
  apiKey: string,
  instructions: string,
  payload: string,
  sourceAgent: string,
  schema: CardResponseSchema = cardSchema,
) {
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
          schema,
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

async function callAnthropic(
  model: string,
  apiKey: string,
  instructions: string,
  payload: string,
  sourceAgent: string,
  schema: CardResponseSchema = cardSchema,
) {
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
          schema,
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
      sourceDocumentTitle: normalizeOptionalString(card?.sourceDocumentTitle),
      sourceSectionTitle: normalizeOptionalString(card?.sourceSectionTitle),
    }))
    .filter((card) => card.type && card.title && card.body)
    .slice(0, 5) as NewAgentCardInput[];
}

function logRetrievedContext(mode: ProviderReviewMode, chunks: RetrievedMemoryChunk[]) {
  if (chunks.length === 0) {
    console.info(`[arm-memory] mode=${mode} retrieved=0`);
    return;
  }

  console.info(
    `[arm-memory] mode=${mode} retrieved=${chunks.length} sources=${chunks
      .map((chunk) => `${chunk.documentTitle}${chunk.sectionTitle ? ` > ${chunk.sectionTitle}` : ""} (${chunk.similarity.toFixed(3)})`)
      .join(" | ")}`,
  );
}

function logCardSources(cards: NewAgentCardInput[]) {
  const attributed = cards.filter((card) => card.sourceDocumentTitle);
  console.info(
    `[arm-memory] cards_with_source=${attributed.length} ${attributed
      .map((card) => `${card.title} -> ${card.sourceDocumentTitle}${card.sourceSectionTitle ? ` > ${card.sourceSectionTitle}` : ""}`)
      .join(" | ")}`,
  );
}

async function retrieveMemoryContext(input: ReviewRequest): Promise<RetrievedMemoryChunk[]> {
  if (projectStore.runtime !== "desktop") return [];

  try {
    return await projectStore.retrieveMemoryContext({
      projectPath: input.projectPath,
      activeDocumentId: input.activeDocument?.id || null,
      currentDocumentMarkdown: input.currentContext,
      focusLine: input.prompt,
      agentType: input.mode,
      limit: 5,
    });
  } catch {
    return [];
  }
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

function chatSourceAgentForMode(mode: ChatPersonaMode) {
  if (mode === "chat") return "CEO Agent";
  if (mode === "product") return "CPO Agent";
  return "Engineering Agent";
}
