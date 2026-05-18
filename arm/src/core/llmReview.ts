import { getApiKey, loadLlmSettings } from "./llmSettings";
import { summarizeJsonDocument } from "./jsonDocument";
import { projectStore } from "./projectStore";
import { generalChatPersona, personaForMode, ReviewPersonaMode } from "./reviewPersonas";
import {
  AgentCardType,
  ChatNote,
  Decision,
  NewAgentCardInput,
  ProjectDocument,
  ProjectReference,
  RetrievedMemoryChunk,
} from "./projectStore";
import { PlanQuestion } from "./planning";
import { normalizePlanModel, planModelSchema, renderPlanMarkdown } from "./planModel";

type ProviderReviewMode = ReviewPersonaMode;
export type ChatPersonaMode = "chat" | ReviewPersonaMode;
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

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
  persona: "chat";
  messages: ChatMessage[];
  latestUserMessage: string;
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

  const instructions = buildChatInstruction(input.persona);

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
      : personaForMode(input.mode);

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

export async function generatePlanWithLlm(input: {
  title: string;
  documents: ProjectDocument[];
  cards: NewAgentCardInput[];
  context: string;
  questions: PlanQuestion[];
}) {
  const settings = loadLlmSettings();
  const apiKey = await getApiKey(settings.provider);
  if (!apiKey) {
    throw new Error(`No ${providerLabel(settings.provider)} API key saved.`);
  }

  const instructions = buildPlanInstruction();
  const payload = buildPlanPayload(input);

  if (settings.provider === "openai") {
    const model = await callOpenAiJson(settings.modelByProvider.openai, apiKey, instructions, payload, planModelSchema, 5000);
    return renderPlanMarkdown(normalizePlanModel(input, model));
  }

  const model = await callAnthropicJson(settings.modelByProvider.anthropic, apiKey, instructions, payload, 5000);
  return renderPlanMarkdown(normalizePlanModel(input, model));
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
  prompt?: string;
  mode?: ChatPersonaMode;
  persona?: "chat";
  messages?: ChatMessage[];
  latestUserMessage?: string;
  activeDocument: ProjectDocument | null;
  currentContext: string;
  notes: ChatNote[];
  decisions: Decision[];
  references: ProjectReference[];
}) {
  return JSON.stringify(
    {
      mode: input.persona || input.mode,
      prompt: input.latestUserMessage || input.prompt,
      latestUserMessage: input.latestUserMessage,
      messages: input.messages?.map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
      activeDocument: input.activeDocument
        ? documentForPayload(input.activeDocument)
        : null,
      currentContext: contextForPayload(input.activeDocument, input.currentContext),
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
        "Use the messages array as the in-session conversation history.",
        "Answer latestUserMessage while preserving continuity with earlier messages.",
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

  const label = mode === "product" ? "product/CEO" : mode === "security" ? "security" : "engineering";
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
        ? documentForPayload(input.activeDocument)
        : null,
      currentContext: contextForPayload(input.activeDocument, input.currentContext),
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
        ? documentForPayload(input.activeDocument)
        : null,
      currentContext: contextForPayload(input.activeDocument, input.currentContext),
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

function buildPlanInstruction() {
  return [
    "You are ARM Plan Mode.",
    "Generate a high-level, implementation-independent delivery plan as JSON.",
    "Do not use a generic template. Synthesize the plan from the source documents, accepted cards, user context, and clarification answers.",
    "The goal is an evaluable planning framework, not technical implementation detail.",
    "Do not write Markdown.",
    "Do not write Mermaid.",
    "ARM will render Markdown pages, QA Review, and Mermaid diagrams from your structured JSON.",
    "Every initiative, epic, and ticket must follow a single responsibility principle.",
    "Each initiative must have: Goal, Single responsibility, Success requirements, and Evaluation criteria.",
    "Each epic must be a coherent outcome area, not a technical layer.",
    "Each ticket must have one clear implementation-independent goal. Do not prescribe code structure, databases, routes, screens, libraries, or architecture unless the source explicitly requires it.",
    "Each ticket must include Requirements for success and Validation criteria.",
    "Use stable ids: initiatives I1, I2, I3; epics I1E1, I1E2; tickets I1E1T1, I1E1T2.",
    "Use initiative dependsOn ids to describe high-level initiative relationships. Use [] for parallel initiatives and previous initiative ids for dependencies.",
    "Keep language clear enough for a non-technical stakeholder to evaluate and specific enough for an engineer to implement however they choose.",
    "Prefer 3 initiatives, with 2 epics per initiative, and 2 to 4 tickets per epic.",
    "Include a final Proceed / Iterate / Kill decision gate tied to the user's measurable signal.",
    "Return JSON only.",
  ].join("\n");
}

function buildPlanPayload(input: {
  title: string;
  documents: ProjectDocument[];
  cards: NewAgentCardInput[];
  context: string;
  questions: PlanQuestion[];
}) {
  const answers = input.questions.map((question) => ({
    question: question.question,
    answer: question.skipped ? "(Skipped; make the safest explicit assumption.)" : question.answer,
    why: question.why,
    impact: question.impact,
    source: question.source,
  }));

  return JSON.stringify(
    {
      requestedTitle: input.title,
      userContext: input.context,
      clarificationAnswers: answers,
      sourceDocuments: input.documents.map((document) => ({
        title: document.name,
        type: document.type,
        ...documentContentForPayload(document, 10000),
      })),
      acceptedCards: input.cards.map((card) => ({
        type: card.type,
        title: card.title,
        body: card.body,
        proposedUpdate: card.proposedUpdate,
        targetSection: card.targetSection,
        sourceAgent: card.sourceAgent,
      })),
      outputContract: {
        headings: [
          "Plan Summary",
          "Initiatives",
          "Epics",
          "Tickets",
          "QA Review",
        ],
        constraints: [
          "Implementation-independent goals.",
          "Single responsibility at initiative, epic, and ticket levels.",
          "Clear success requirements.",
          "Clear validation criteria.",
          "No unnecessary technical detail.",
          "Mermaid diagrams: one initiative-to-epics diagram per initiative.",
          "Mermaid diagrams: one epic-to-tickets diagram per epic.",
          "Mermaid diagrams: one plan-summary initiative relationship diagram directly after Plan Summary.",
          "QA Review is generated by ARM from initiatives, epics, tickets, and the decision gate.",
          "Every Mermaid endpoint must be declared as a labeled node in the same diagram.",
          "Every Mermaid label must contain real work item text and a Target line.",
          "No placeholder-only labels in diagrams.",
        ],
      },
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

async function callOpenAiText(model: string, apiKey: string, instructions: string, payload: string, maxOutputTokens = 1400) {
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
      max_output_tokens: maxOutputTokens,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || "OpenAI request failed.");
  }

  return extractOpenAiText(result).trim();
}

async function callOpenAiJson(
  model: string,
  apiKey: string,
  instructions: string,
  payload: string,
  schema: unknown,
  maxOutputTokens = 1400,
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
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          type: "json_schema",
          name: "arm_plan_model",
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

  return JSON.parse(extractOpenAiText(result));
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

async function callAnthropicText(model: string, apiKey: string, instructions: string, payload: string, maxTokens = 1400) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
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

async function callAnthropicJson(model: string, apiKey: string, instructions: string, payload: string, maxTokens = 1400) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: instructions,
      messages: [{ role: "user", content: payload }],
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || "Anthropic request failed.");
  }

  return parseJsonObject(extractAnthropicText(result));
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

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)?.[1];
  if (fenced) return JSON.parse(fenced);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("LLM response did not contain a JSON object.");
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

function truncateForPayload(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[Truncated for planning context]`;
}

function documentForPayload(document: ProjectDocument) {
  return {
    name: document.name,
    type: document.type,
    ...documentContentForPayload(document, 8000),
  };
}

function documentContentForPayload(document: ProjectDocument, maxRawChars: number) {
  if (document.type !== "json") {
    return { markdown: truncateForPayload(document.markdown, maxRawChars) };
  }

  const summary = summarizeJsonDocument(document.markdown, maxRawChars);
  return {
    contentType: "JSON",
    markdown: summary.raw || summary.summary,
    rawJson: summary.raw,
    jsonSummary: summary.summary,
    validationWarnings: summary.warnings,
    jsonRules: [
      "JSON is the source of truth.",
      "Do not silently rewrite JSON.",
      "When suggesting changes, describe a proposed replacement or targeted edit for user review.",
    ],
  };
}

function contextForPayload(activeDocument: ProjectDocument | null, currentContext: string) {
  if (activeDocument?.type !== "json") return currentContext;
  const summary = summarizeJsonDocument(currentContext, 8000);
  return summary.raw || summary.summary;
}

function repairPlanMermaidLabels(markdown: string) {
  const sections = splitMarkdownSections(markdown);
  const initiatives = extractPlanItems(markdown, "Initiative");
  const epics = extractPlanItems(markdown, "Epic");
  const tickets = extractPlanItems(markdown, "Ticket");

  return markdown.replace(/```mermaid\s*([\s\S]*?)```/gi, (full, mermaid: string, offset: number) => {
    const section = sections.find((item) => offset >= item.start && offset < item.end);
    const beforeBlock = markdown.slice(Math.max(0, offset - 1600), offset);
    const subject = nearestPlanHeading(beforeBlock);
    const repaired = repairOneMermaidBlock(mermaid, {
      sectionTitle: section?.title || "",
      subject,
      initiatives,
      epics,
      tickets,
    });
    return `\`\`\`mermaid\n${repaired.trim()}\n\`\`\``;
  });
}

type ExtractedPlanItem = {
  kind: "Initiative" | "Epic" | "Ticket";
  number: string;
  title: string;
  target: string;
};

function repairOneMermaidBlock(
  mermaid: string,
  context: {
    sectionTitle: string;
    subject: { kind: "Initiative" | "Epic" | "Ticket"; number: string; title: string } | null;
    initiatives: ExtractedPlanItem[];
    epics: ExtractedPlanItem[];
    tickets: ExtractedPlanItem[];
  },
) {
  const lines = mermaid.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const direction = lines.find((line) => /^(flowchart|graph)\b/i.test(line)) || "flowchart TD";
  const relationships = lines
    .map((line) => /^([A-Za-z0-9_:-]+)(?:\s*\[[^\]]+\])?\s*-->(?:\|([^|]+)\|)?\s*([A-Za-z0-9_:-]+)/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({ sourceId: match[1], label: match[2] || "", targetId: match[3] }));
  const endpointIds = uniqueStrings(relationships.flatMap((item) => [item.sourceId, item.targetId]));
  const existingLabels = new Map<string, string>();

  for (const line of lines) {
    for (const node of line.matchAll(/([A-Za-z0-9_:-]+)\s*\[\s*"([^"]+)"\s*\]/g)) {
      existingLabels.set(node[1], node[2]);
    }
  }

  const labelItems = choosePlanItemsForMermaid(endpointIds, context);
  const nodeLines = endpointIds.map((id, index) => {
    const existing = existingLabels.get(id);
    const item = labelLooksComplete(existing) ? null : labelItems[index];
    const label = item ? `${item.title}<br/>Target: ${item.target}` : existing || `${id}<br/>Target: Define this work item.`;
    return `  ${id}["${escapeMermaid(label)}"]`;
  });
  const relationshipLines = relationships.map((item) =>
    `  ${item.sourceId} -->${item.label ? `|${item.label}|` : ""} ${item.targetId}`,
  );

  return [direction, ...nodeLines, ...relationshipLines].join("\n");
}

function choosePlanItemsForMermaid(
  endpointIds: string[],
  context: {
    sectionTitle: string;
    subject: { kind: "Initiative" | "Epic" | "Ticket"; number: string; title: string } | null;
    initiatives: ExtractedPlanItem[];
    epics: ExtractedPlanItem[];
    tickets: ExtractedPlanItem[];
  },
) {
  if (/plan summary/i.test(context.sectionTitle)) {
    return endpointIds.map((_id, index) => context.initiatives[index]).filter(Boolean);
  }

  if (/initiatives/i.test(context.sectionTitle)) {
    const initiative = context.subject?.kind === "Initiative"
      ? context.initiatives.find((item) => item.number === context.subject?.number)
      : context.initiatives[0];
    const childEpics = initiative
      ? context.epics.filter((item) => item.number.startsWith(`${initiative.number}.`))
      : context.epics;
    return [initiative, ...childEpics].filter(Boolean);
  }

  if (/epics/i.test(context.sectionTitle)) {
    const epic = context.subject?.kind === "Epic"
      ? context.epics.find((item) => item.number === context.subject?.number)
      : context.epics[0];
    const childTickets = epic
      ? context.tickets.filter((item) => item.number.startsWith(`${epic.number}.`))
      : context.tickets;
    return [epic, ...childTickets].filter(Boolean);
  }

  return endpointIds.map((_id, index) => [...context.initiatives, ...context.epics, ...context.tickets][index]).filter(Boolean);
}

function splitMarkdownSections(markdown: string) {
  const headings = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  return headings.map((heading, index) => ({
    title: heading[1].trim(),
    start: heading.index || 0,
    end: headings[index + 1]?.index ?? markdown.length,
  }));
}

function nearestPlanHeading(text: string) {
  const headings = [...text.matchAll(/^#{3,5}\s+(?:\*\*)?(Initiative|Epic|Ticket)\s+([\d.]+)\s*(?::|-|\.|\))\s*(.+?)(?:\*\*)?\s*$/gim)];
  const heading = headings[headings.length - 1];
  return heading
    ? {
        kind: heading[1] as "Initiative" | "Epic" | "Ticket",
        number: heading[2],
        title: heading[3].trim(),
      }
    : null;
}

function extractPlanItems(markdown: string, kind: "Initiative" | "Epic" | "Ticket"): ExtractedPlanItem[] {
  const explicitPattern = new RegExp(`^\\s*(?:[-*]\\s*)?(?:#{3,5}\\s*)?(?:\\*\\*)?${kind}\\s+([\\d.]+)\\s*(?::|-|\\.|\\))\\s*(.+?)(?:\\*\\*)?\\s*$`, "gim");
  const matches = [...markdown.matchAll(explicitPattern)];
  if (matches.length === 0) {
    const section = sectionForPlanKind(markdown, kind);
    const numberedPattern = /^#{3,5}\s+([\d.]+)\s*(?::|-|\.|\))\s*(.+)$/gim;
    return [...section.matchAll(numberedPattern)]
      .filter((match) => numberMatchesPlanKind(match[1], kind))
      .map((match) => extractedPlanItemFromMatch(section, match, kind));
  }

  return matches.map((match) => extractedPlanItemFromMatch(markdown, match, kind));
}

function extractedPlanItemFromMatch(
  markdown: string,
  match: RegExpMatchArray,
  kind: "Initiative" | "Epic" | "Ticket",
): ExtractedPlanItem {
    const start = match.index || 0;
    const nextHeading = markdown.slice(start + match[0].length).search(/^#{3,5}\s+|\n\s*(?:[-*]\s*)?(?:\*\*)?(?:Initiative|Epic|Ticket)\s+[\d.]+\s*(?::|-|\.|\))/m);
    const end = nextHeading === -1 ? markdown.length : start + match[0].length + nextHeading;
    const block = markdown.slice(start, end);
    return {
      kind,
      number: match[1],
      title: match[2].trim(),
      target: /(?:Goal|Target):\s*(.+)/i.exec(block)?.[1]?.trim() || "Define the outcome of this block of work.",
    };
}

function sectionForPlanKind(markdown: string, kind: "Initiative" | "Epic" | "Ticket") {
  const sectionTitle = kind === "Initiative" ? "Initiatives" : `${kind}s`;
  const pattern = new RegExp(`^##\\s+${sectionTitle}\\s*$`, "im");
  const match = pattern.exec(markdown);
  if (!match) return markdown;
  const start = match.index + match[0].length;
  const next = markdown.slice(start).search(/^##\s+/m);
  return markdown.slice(start, next === -1 ? markdown.length : start + next);
}

function numberMatchesPlanKind(number: string, kind: "Initiative" | "Epic" | "Ticket") {
  const depth = number.split(".").filter(Boolean).length;
  if (kind === "Initiative") return depth === 1;
  if (kind === "Epic") return depth === 2;
  return depth >= 3;
}

function labelLooksComplete(label: string | undefined) {
  if (!label) return false;
  const normalized = label.replace(/<br\s*\/?>/gi, "\n").trim();
  const [title, target] = normalized.split(/\n+/).map((line) => line.trim());
  return Boolean(title && !/^[A-Z]\d*$/i.test(title) && /^Target:\s+\S+/i.test(target || ""));
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function escapeMermaid(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function providerLabel(provider: "openai" | "anthropic") {
  return provider === "openai" ? "OpenAI" : "Anthropic";
}

function sourceAgentForMode(mode: ProviderReviewMode) {
  if (mode === "product") return "CPO Agent";
  if (mode === "security") return "Security Agent";
  return "Engineering Agent";
}

function chatSourceAgentForMode(mode: ChatPersonaMode) {
  if (mode === "chat") return "CEO Agent";
  if (mode === "product") return "CPO Agent";
  if (mode === "security") return "Security Agent";
  return "Engineering Agent";
}
