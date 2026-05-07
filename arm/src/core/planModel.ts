import { PlanMode, PlanQuestion } from "./planning";
import { AgentCard, NewAgentCardInput, ProjectDocument } from "./projectStore";

export type PlanTicketModel = {
  id: string;
  title: string;
  goal: string;
  requirements: string[];
  validation: string[];
};

export type PlanEpicModel = {
  id: string;
  title: string;
  goal: string;
  responsibility: string;
  tickets: PlanTicketModel[];
};

export type PlanInitiativeModel = {
  id: string;
  title: string;
  goal: string;
  responsibility: string;
  successRequirements: string[];
  evaluationCriteria: string[];
  dependsOn: string[];
  epics: PlanEpicModel[];
};

export type PlanDocumentModel = {
  title: string;
  mode: PlanMode;
  timecode?: string;
  outcome: string;
  constraint: string;
  decisionSignal: string;
  planningContext: string;
  sourceSynthesis: string[];
  clarifications: Array<{ question: string; answer: string }>;
  initiatives: PlanInitiativeModel[];
  decisionGate: {
    proceed: string;
    iterate: string;
    kill: string;
  };
};

type PlanModelInput = {
  title: string;
  mode: PlanMode;
  documents: ProjectDocument[];
  cards: Array<AgentCard | NewAgentCardInput>;
  context: string;
  questions: PlanQuestion[];
};

export function normalizePlanModel(input: PlanModelInput, raw: unknown): PlanDocumentModel {
  const fallback = buildFallbackPlanModel(input);
  const source = isRecord(raw) ? raw : {};
  const initiatives = normalizeInitiatives(source.initiatives, fallback.initiatives);

  return {
    title: cleanText(source.title, fallback.title),
    mode: input.mode,
    timecode: cleanOptionalText(source.timecode) || fallback.timecode,
    outcome: cleanText(source.outcome, fallback.outcome),
    constraint: cleanText(source.constraint, fallback.constraint),
    decisionSignal: cleanText(source.decisionSignal, fallback.decisionSignal),
    planningContext: cleanText(source.planningContext, fallback.planningContext),
    sourceSynthesis: cleanStringList(source.sourceSynthesis, fallback.sourceSynthesis),
    clarifications: normalizeClarifications(source.clarifications, fallback.clarifications),
    initiatives,
    decisionGate: normalizeDecisionGate(source.decisionGate, fallback.decisionGate),
  };
}

export function buildFallbackPlanModel(input: PlanModelInput): PlanDocumentModel {
  const answers = input.questions.map((question) => ({
    question: question.question,
    answer: question.skipped ? defaultAnswerForQuestion(question.id, input.mode) : question.answer.trim(),
  }));
  const outcome = answerFor(input.questions, "outcome", input.mode);
  const constraint = answerFor(input.questions, "constraint", input.mode);
  const decisionSignal = answerFor(input.questions, "signal", input.mode);
  const sourceSynthesis = summarizeSources(input.documents, input.cards);

  return {
    title: input.title,
    mode: input.mode,
    outcome,
    constraint,
    decisionSignal,
    planningContext: input.context.trim() || "No additional context supplied.",
    sourceSynthesis,
    clarifications: answers,
    initiatives: [
      initiative("I1", "Product Scope and Success Boundary", `Define the smallest product outcome that can prove: ${outcome}.`, "Set the product promise and success boundary.", [
        epic("I1E1", "Outcome Definition", "Make the desired user or business outcome explicit.", [
          ticket("I1E1T1", "State the target outcome", `Define the outcome in user or business language: ${outcome}.`),
          ticket("I1E1T2", "Define the decision signal", `Translate the success signal into proceed, iterate, and kill conditions: ${decisionSignal}.`),
        ]),
        epic("I1E2", "Scope Boundary", "Separate essential scope from deferred scope.", [
          ticket("I1E2T1", "Identify the essential journey", "Describe the shortest complete journey that can prove value."),
          ticket("I1E2T2", "Name key assumptions", "Capture the assumptions that could make the plan wrong or too broad."),
        ]),
      ]),
      initiative("I2", "Complete User Value Journey", "Deliver one complete journey that creates recognizable user value.", "Make the core workflow usable from start to finish.", [
        epic("I2E1", "Primary Journey", "Enable the user to reach the first meaningful result.", [
          ticket("I2E1T1", "Enable the first meaningful action", "Let the user take the action that starts the value journey."),
          ticket("I2E1T2", "Present a useful result", "Show the outcome in a way the user can evaluate and act on."),
        ]),
        epic("I2E2", "Continuity and Correction", "Let users recover, refine, and continue without losing meaning.", [
          ticket("I2E2T1", "Support meaningful revision", "Let the user correct or refine work without losing progress."),
          ticket("I2E2T2", "Preserve current work", "Ensure the latest meaningful version is what the user sees."),
        ]),
      ], ["I1"]),
      initiative("I3", "Validation and Decision Loop", `Evaluate the finished journey against: ${decisionSignal}.`, "Turn delivery evidence into a proceed, iterate, or kill decision.", [
        epic("I3E1", "Experience Validation", "Confirm the journey delivers user-facing value under the stated constraint.", [
          ticket("I3E1T1", "Evaluate the full journey", "Review the work from the user's perspective end to end."),
          ticket("I3E1T2", "Confirm readiness against constraints", `Check whether the work is good enough under the constraint: ${constraint}.`),
        ]),
        epic("I3E2", "Evidence and Decision", "Collect evidence and choose the next direction.", [
          ticket("I3E2T1", "Collect decision evidence", `Gather evidence for the measurable signal: ${decisionSignal}.`),
          ticket("I3E2T2", "Make the next decision", "Choose proceed, iterate, or kill based on evidence rather than effort invested."),
        ]),
      ], ["I1", "I2"]),
    ],
    decisionGate: {
      proceed: `${decisionSignal} is met and no critical blocker remains.`,
      iterate: "The journey works, but the signal is weak or one clear improvement is needed.",
      kill: "The work cannot produce meaningful value within the stated constraint.",
    },
  };
}

export function renderPlanMarkdown(model: PlanDocumentModel) {
  return ensureTrailingNewline([
    `# ${model.title}`,
    model.timecode ? `\nTimecode: ${model.timecode}` : "",
    "",
    "## Plan Summary",
    `Plan type: ${model.mode === "kill" ? "Kill Plan" : "Focused Delivery Plan"}`,
    `Business outcome: ${model.outcome}`,
    `Delivery constraint: ${model.constraint}`,
    `Decision signal: ${model.decisionSignal}`,
    "",
    "### Planning Context",
    model.planningContext,
    "",
    "### Source Synthesis",
    ...model.sourceSynthesis.map((item) => `- ${item}`),
    "",
    "### Clarifications",
    ...model.clarifications.map((item) => `- ${item.question}: ${item.answer}`),
    "",
    "### Execution Strategy",
    "- Keep the plan high-level and implementation-independent.",
    "- Each initiative, epic, and ticket has one responsibility and one clear success condition.",
    "- Engineers may choose any implementation approach that satisfies the stated goal and success requirements.",
    "",
    "```mermaid",
    renderInitiativeRelationshipMermaid(model.initiatives),
    "```",
    "",
    "## Initiatives",
    ...model.initiatives.flatMap(renderInitiativeSection),
    "",
    "## Epics",
    ...model.initiatives.flatMap((item) => item.epics.flatMap((epic) => renderEpicSection(item, epic))),
    "",
    "## Tickets",
    ...model.initiatives.flatMap((item) => item.epics.flatMap((epic) => epic.tickets.flatMap((ticketItem) => renderTicketSection(item, epic, ticketItem)))),
    "",
    "### Decision After Execution",
    `- [ ] Proceed: ${model.decisionGate.proceed}`,
    `- [ ] Iterate: ${model.decisionGate.iterate}`,
    `- [ ] Kill: ${model.decisionGate.kill}`,
    "",
  ].join("\n"));
}

export const planModelSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "timecode", "outcome", "constraint", "decisionSignal", "planningContext", "sourceSynthesis", "clarifications", "initiatives", "decisionGate"],
  properties: {
    title: { type: "string" },
    timecode: { type: ["string", "null"] },
    outcome: { type: "string" },
    constraint: { type: "string" },
    decisionSignal: { type: "string" },
    planningContext: { type: "string" },
    sourceSynthesis: { type: "array", items: { type: "string" } },
    clarifications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer"],
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
      },
    },
    initiatives: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "goal", "responsibility", "successRequirements", "evaluationCriteria", "dependsOn", "epics"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          goal: { type: "string" },
          responsibility: { type: "string" },
          successRequirements: { type: "array", items: { type: "string" } },
          evaluationCriteria: { type: "array", items: { type: "string" } },
          dependsOn: { type: "array", items: { type: "string" } },
          epics: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "title", "goal", "responsibility", "tickets"],
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                goal: { type: "string" },
                responsibility: { type: "string" },
                tickets: {
                  type: "array",
                  minItems: 1,
                  maxItems: 6,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "title", "goal", "requirements", "validation"],
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      goal: { type: "string" },
                      requirements: { type: "array", items: { type: "string" } },
                      validation: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    decisionGate: {
      type: "object",
      additionalProperties: false,
      required: ["proceed", "iterate", "kill"],
      properties: {
        proceed: { type: "string" },
        iterate: { type: "string" },
        kill: { type: "string" },
      },
    },
  },
} as const;

function renderInitiativeSection(item: PlanInitiativeModel) {
  return [
    `### Initiative ${numberFromId(item.id, "I")}: ${item.title}`,
    `Goal: ${item.goal}`,
    `Single responsibility: ${item.responsibility}`,
    "Success requirements:",
    ...item.successRequirements.map((value) => `- ${value}`),
    "Evaluation criteria:",
    ...item.evaluationCriteria.map((value) => `- ${value}`),
    "",
    "```mermaid",
    renderInitiativeEpicMermaid(item),
    "```",
    "",
  ];
}

function renderEpicSection(initiativeItem: PlanInitiativeModel, epicItem: PlanEpicModel) {
  return [
    `### Epic ${numberFromEpicId(epicItem.id)}: ${epicItem.title}`,
    `Parent initiative: ${initiativeItem.title}`,
    `Goal: ${epicItem.goal}`,
    `Single responsibility: ${epicItem.responsibility}`,
    "",
    "```mermaid",
    renderEpicTicketMermaid(epicItem),
    "```",
    "",
  ];
}

function renderTicketSection(initiativeItem: PlanInitiativeModel, epicItem: PlanEpicModel, ticketItem: PlanTicketModel) {
  return [
    `#### Ticket ${numberFromTicketId(ticketItem.id)}: ${ticketItem.title}`,
    `Parent initiative: ${initiativeItem.title}`,
    `Parent epic: ${epicItem.title}`,
    `Goal: ${ticketItem.goal}`,
    "Requirements for success:",
    ...ticketItem.requirements.map((value) => `- ${value}`),
    "Validation criteria:",
    ...ticketItem.validation.map((value) => `- ${value}`),
    "",
  ];
}

function renderInitiativeRelationshipMermaid(initiatives: PlanInitiativeModel[]) {
  const nodes = initiatives.map((item) => `  ${item.id}["${mermaidLabel(item.title, item.goal)}"]`);
  const edges = initiatives.flatMap((item, index) => {
    if (item.dependsOn.length > 0) return item.dependsOn.map((dependency) => `  ${dependency} -->|enables| ${item.id}`);
    if (index === 0) return [];
    return [`  ${initiatives[index - 1].id} -->|enables| ${item.id}`];
  });
  return ["flowchart LR", ...nodes, ...edges].join("\n");
}

function renderInitiativeEpicMermaid(item: PlanInitiativeModel) {
  return [
    "flowchart TD",
    `  ${item.id}["${mermaidLabel(item.title, item.goal)}"]`,
    ...item.epics.map((epicItem) => `  ${epicItem.id}["${mermaidLabel(epicItem.title, epicItem.goal)}"]`),
    ...item.epics.map((epicItem) => `  ${item.id} --> ${epicItem.id}`),
  ].join("\n");
}

function renderEpicTicketMermaid(item: PlanEpicModel) {
  return [
    "flowchart TD",
    `  ${item.id}["${mermaidLabel(item.title, item.goal)}"]`,
    ...item.tickets.map((ticketItem) => `  ${ticketItem.id}["${mermaidLabel(ticketItem.title, ticketItem.goal)}"]`),
    ...item.tickets.map((ticketItem) => `  ${item.id} --> ${ticketItem.id}`),
  ].join("\n");
}

function initiative(
  id: string,
  title: string,
  goal: string,
  responsibility: string,
  epics: PlanEpicModel[],
  dependsOn: string[] = [],
): PlanInitiativeModel {
  return {
    id,
    title,
    goal,
    responsibility,
    successRequirements: [
      "The goal is clear enough for a non-technical stakeholder to evaluate.",
      "The work has one responsibility and can be judged independently.",
    ],
    evaluationCriteria: [
      "A reviewer can tell whether the goal was achieved without inspecting implementation details.",
      "The work advances the decision signal directly.",
    ],
    dependsOn,
    epics,
  };
}

function epic(id: string, title: string, goal: string, tickets: PlanTicketModel[]): PlanEpicModel {
  return {
    id,
    title,
    goal,
    responsibility: goal,
    tickets,
  };
}

function ticket(id: string, title: string, goal: string): PlanTicketModel {
  return {
    id,
    title,
    goal,
    requirements: [
      "The expected outcome is visible to the user or stakeholder.",
      "The work can be completed without prescribing a specific implementation approach.",
    ],
    validation: [
      "A reviewer can verify the outcome from the product behavior or artifact.",
      "The result supports the parent epic goal.",
    ],
  };
}

function normalizeInitiatives(value: unknown, fallback: PlanInitiativeModel[]) {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value.map((rawItem, index) => {
    const source = isRecord(rawItem) ? rawItem : {};
    const fallbackItem = fallback[index] || fallback[0];
    const id = normalizeId(source.id, `I${index + 1}`);
    const epics = normalizeEpics(source.epics, fallbackItem.epics, id);
    return {
      id,
      title: cleanText(source.title, fallbackItem.title),
      goal: cleanText(source.goal, fallbackItem.goal),
      responsibility: cleanText(source.responsibility, fallbackItem.responsibility),
      successRequirements: cleanStringList(source.successRequirements, fallbackItem.successRequirements),
      evaluationCriteria: cleanStringList(source.evaluationCriteria, fallbackItem.evaluationCriteria),
      dependsOn: cleanStringList(source.dependsOn, fallbackItem.dependsOn).map((item) => normalizeId(item, item)),
      epics,
    };
  });
}

function normalizeEpics(value: unknown, fallback: PlanEpicModel[], initiativeId: string) {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value.map((rawItem, index) => {
    const source = isRecord(rawItem) ? rawItem : {};
    const fallbackItem = fallback[index] || fallback[0];
    const id = normalizeId(source.id, `${initiativeId}E${index + 1}`);
    return {
      id,
      title: cleanText(source.title, fallbackItem.title),
      goal: cleanText(source.goal, fallbackItem.goal),
      responsibility: cleanText(source.responsibility, fallbackItem.responsibility),
      tickets: normalizeTickets(source.tickets, fallbackItem.tickets, id),
    };
  });
}

function normalizeTickets(value: unknown, fallback: PlanTicketModel[], epicId: string) {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value.map((rawItem, index) => {
    const source = isRecord(rawItem) ? rawItem : {};
    const fallbackItem = fallback[index] || fallback[0];
    return {
      id: normalizeId(source.id, `${epicId}T${index + 1}`),
      title: cleanText(source.title, fallbackItem.title),
      goal: cleanText(source.goal, fallbackItem.goal),
      requirements: cleanStringList(source.requirements, fallbackItem.requirements),
      validation: cleanStringList(source.validation, fallbackItem.validation),
    };
  });
}

function normalizeClarifications(value: unknown, fallback: Array<{ question: string; answer: string }>) {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value.map((item, index) => {
    const source = isRecord(item) ? item : {};
    const fallbackItem = fallback[index] || fallback[0];
    return {
      question: cleanText(source.question, fallbackItem.question),
      answer: cleanText(source.answer, fallbackItem.answer),
    };
  });
}

function normalizeDecisionGate(value: unknown, fallback: PlanDocumentModel["decisionGate"]) {
  const source = isRecord(value) ? value : {};
  return {
    proceed: cleanText(source.proceed, fallback.proceed),
    iterate: cleanText(source.iterate, fallback.iterate),
    kill: cleanText(source.kill, fallback.kill),
  };
}

function answerFor(questions: PlanQuestion[], id: string, mode: PlanMode) {
  const question = questions.find((item) => item.id === id);
  if (!question || question.skipped || !question.answer.trim()) return defaultAnswerForQuestion(id, mode);
  return question.answer.trim();
}

function summarizeSources(documents: ProjectDocument[], cards: Array<AgentCard | NewAgentCardInput>) {
  const documentSummaries = documents.slice(0, 4).map((document) =>
    `${document.type}: ${document.name} - ${trimSentence(firstMeaningfulLine(document.markdown) || "Selected as a planning source.", 180)}`,
  );
  const cardSummaries = cards.slice(0, 4).map((cardItem) =>
    `${cardItem.sourceAgent}: ${cardItem.title} - ${trimSentence(cardItem.body, 180)}`,
  );
  return [...documentSummaries, ...cardSummaries].slice(0, 6);
}

function defaultAnswerForQuestion(id: string, mode: PlanMode) {
  if (id === "outcome") {
    return mode === "kill" ? "Find the cheapest invalidating signal." : "Reduce the largest planning risk.";
  }
  if (id === "constraint") return "Keep the work small enough for a solo builder or small team.";
  return "Use observable evidence to choose proceed, iterate, or kill.";
}

function cleanStringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.map((item) => cleanOptionalText(item)).filter((item): item is string => Boolean(item));
  return cleaned.length > 0 ? cleaned : fallback;
}

function cleanText(value: unknown, fallback: string) {
  return cleanOptionalText(value) || fallback;
}

function cleanOptionalText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeId(value: unknown, fallback: string) {
  const cleaned = cleanOptionalText(value).replace(/[^A-Za-z0-9_:-]/g, "");
  return cleaned || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function mermaidLabel(title: string, target: string) {
  return escapeMermaidLabel(`${title}<br/>Target: ${target}`);
}

function escapeMermaidLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function numberFromId(id: string, prefix: string) {
  return new RegExp(`^${prefix}(\\d+)`, "i").exec(id)?.[1] || id;
}

function numberFromEpicId(id: string) {
  const match = /^I(\d+)E(\d+)$/i.exec(id);
  return match ? `${match[1]}.${match[2]}` : id;
}

function numberFromTicketId(id: string) {
  const match = /^I(\d+)E(\d+)T(\d+)$/i.exec(id);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : id;
}

function firstMeaningfulLine(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && line !== "-");
}

function trimSentence(value: string, maxLength = 220) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3)}...` : cleaned;
}

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
}
