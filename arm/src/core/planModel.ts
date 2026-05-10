import { PlanQuestion } from "./planning";
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
  documents: ProjectDocument[];
  cards: Array<AgentCard | NewAgentCardInput>;
  context: string;
  questions: PlanQuestion[];
};

export function normalizePlanModel(input: PlanModelInput, raw: unknown): PlanDocumentModel {
  if (!isRecord(raw)) {
    throw new Error("Plan generation returned an unreadable response.");
  }
  const source = raw;
  const initiatives = normalizeInitiatives(source.initiatives);
  if (initiatives.length === 0) {
    throw new Error("Plan generation did not return any initiatives.");
  }

  return {
    title: cleanText(source.title, input.title),
    timecode: cleanOptionalText(source.timecode),
    outcome: cleanRequiredText(source.outcome, "outcome"),
    constraint: cleanRequiredText(source.constraint, "constraint"),
    decisionSignal: cleanRequiredText(source.decisionSignal, "decision signal"),
    planningContext: cleanText(source.planningContext, input.context.trim() || "No additional context supplied."),
    sourceSynthesis: cleanStringList(source.sourceSynthesis),
    clarifications: normalizeClarifications(source.clarifications),
    initiatives,
    decisionGate: normalizeDecisionGate(source.decisionGate),
  };
}

export function renderPlanMarkdown(model: PlanDocumentModel) {
  return ensureTrailingNewline([
    `# ${model.title}`,
    model.timecode ? `\n**Timecode:** ${model.timecode}` : "",
    "",
    "## Plan Summary",
    "**Plan type:** Delivery Plan",
    `**Business outcome:** ${model.outcome}`,
    `**Delivery constraint:** ${model.constraint}`,
    `**Decision signal:** ${model.decisionSignal}`,
    "",
    "### Planning Context",
    model.planningContext,
    "",
    "### Source Synthesis",
    ...model.sourceSynthesis.map((item) => `- ${item}`),
    "",
    "### Clarifications",
    ...model.clarifications.map((item) => `- **${item.question}:** ${item.answer}`),
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
    "## QA Review",
    ...renderQaReviewSection(model),
    "",
    "### Decision After Execution",
    `- [ ] **Proceed:** ${model.decisionGate.proceed}`,
    `- [ ] **Iterate:** ${model.decisionGate.iterate}`,
    `- [ ] **Kill:** ${model.decisionGate.kill}`,
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
    `**Goal:** ${item.goal}`,
    `**Single responsibility:** ${item.responsibility}`,
    "",
    "**Success requirements:**",
    ...item.successRequirements.map((value) => `- ${value}`),
    "",
    "**Evaluation criteria:**",
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
    `**Parent initiative:** ${initiativeItem.title}`,
    `**Goal:** ${epicItem.goal}`,
    `**Single responsibility:** ${epicItem.responsibility}`,
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
    `**Parent initiative:** ${initiativeItem.title}`,
    `**Parent epic:** ${epicItem.title}`,
    `**Goal:** ${ticketItem.goal}`,
    "",
    "**Requirements for success:**",
    ...ticketItem.requirements.map((value) => `- ${value}`),
    "",
    "**Validation criteria:**",
    ...ticketItem.validation.map((value) => `- ${value}`),
    "",
  ];
}

function renderQaReviewSection(model: PlanDocumentModel) {
  const epics = model.initiatives.flatMap((initiativeItem) =>
    initiativeItem.epics.map((epicItem) => ({ initiative: initiativeItem, epic: epicItem })),
  );
  const tickets = epics.flatMap(({ initiative: initiativeItem, epic: epicItem }) =>
    epicItem.tickets.map((ticketItem) => ({ initiative: initiativeItem, epic: epicItem, ticket: ticketItem })),
  );

  return [
    "### QA Objective",
    `Validate the complete plan end to end against the business outcome: ${model.outcome}`,
    `**Decision signal:** ${model.decisionSignal}`,
    "",
    "### Test Scope",
    "- Confirm that each initiative can be evaluated independently.",
    "- Confirm that each epic produces a visible outcome that supports its parent initiative.",
    "- Confirm that each ticket can be validated without prescribing a specific implementation.",
    "- Confirm that failure, incomplete input, and recovery paths are understood before release.",
    "",
    "### End-to-End Test Scenarios",
    ...epics.flatMap(({ initiative: initiativeItem, epic: epicItem }, index) => [
      `#### Scenario ${index + 1}: ${epicItem.title}`,
      `**Purpose:** Prove that "${epicItem.goal}" supports "${initiativeItem.title}".`,
      "",
      "**Setup:**",
      `- Use the smallest representative workflow that exercises ${epicItem.title}.`,
      "- Start from a clean or clearly understood project state.",
      "",
      "**Execution:**",
      ...epicItem.tickets.map((ticketItem) => `- Verify: ${ticketItem.goal}`),
      "",
      "**Expected Result:**",
      `- The user or reviewer can observe that ${epicItem.goal}`,
      "",
      "**Evidence to Capture:**",
      "- Notes, screenshots, logs, or user observations sufficient to support the decision gate.",
      "",
    ]),
    "### Ticket Acceptance Matrix",
    ...tickets.flatMap(({ initiative: initiativeItem, epic: epicItem, ticket: ticketItem }) => [
      `#### ${numberFromTicketId(ticketItem.id)} ${ticketItem.title}`,
      `**Parent initiative:** ${initiativeItem.title}`,
      `**Parent epic:** ${epicItem.title}`,
      `**Acceptance goal:** ${ticketItem.goal}`,
      "",
      "**Requirements under test:**",
      ...ticketItem.requirements.map((value) => `- ${value}`),
      "",
      "**Validation checks:**",
      ...ticketItem.validation.map((value) => `- ${value}`),
      "",
    ]),
    "### Regression Coverage",
    "- Re-run the primary happy path after each completed epic.",
    "- Re-check any work that changes saved data, retrieved context, permissions, or user-visible outputs.",
    "- Confirm previously accepted tickets still satisfy their validation criteria after later work is added.",
    "",
    "### Edge Cases and Negative Tests",
    "- Missing or incomplete user input.",
    "- Stale or deleted project data.",
    "- Conflicting references, notes, cards, or source documents.",
    "- Interrupted workflows and reload/resume behavior.",
    "- Permission, privacy, or security-sensitive boundaries named in the plan.",
    "",
    "### Release Readiness Review",
    `- **Proceed only if:** ${model.decisionGate.proceed}`,
    `- **Iterate if:** ${model.decisionGate.iterate}`,
    `- **Kill or stop if:** ${model.decisionGate.kill}`,
    "- Record the evidence that supports the decision.",
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

function normalizeInitiatives(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((rawItem, index) => {
    const source = isRecord(rawItem) ? rawItem : {};
    const id = normalizeId(source.id, `I${index + 1}`);
    const epics = normalizeEpics(source.epics, id);
    return {
      id,
      title: cleanRequiredText(source.title, `initiative ${index + 1} title`),
      goal: cleanRequiredText(source.goal, `initiative ${index + 1} goal`),
      responsibility: cleanRequiredText(source.responsibility, `initiative ${index + 1} responsibility`),
      successRequirements: cleanStringList(source.successRequirements),
      evaluationCriteria: cleanStringList(source.evaluationCriteria),
      dependsOn: cleanStringList(source.dependsOn).map((item) => normalizeId(item, item)),
      epics,
    };
  });
}

function normalizeEpics(value: unknown, initiativeId: string) {
  if (!Array.isArray(value)) return [];
  return value.map((rawItem, index) => {
    const source = isRecord(rawItem) ? rawItem : {};
    const id = normalizeId(source.id, `${initiativeId}E${index + 1}`);
    return {
      id,
      title: cleanRequiredText(source.title, `epic ${id} title`),
      goal: cleanRequiredText(source.goal, `epic ${id} goal`),
      responsibility: cleanRequiredText(source.responsibility, `epic ${id} responsibility`),
      tickets: normalizeTickets(source.tickets, id),
    };
  });
}

function normalizeTickets(value: unknown, epicId: string) {
  if (!Array.isArray(value)) return [];
  return value.map((rawItem, index) => {
    const source = isRecord(rawItem) ? rawItem : {};
    return {
      id: normalizeId(source.id, `${epicId}T${index + 1}`),
      title: cleanRequiredText(source.title, `ticket ${epicId}.${index + 1} title`),
      goal: cleanRequiredText(source.goal, `ticket ${epicId}.${index + 1} goal`),
      requirements: cleanStringList(source.requirements),
      validation: cleanStringList(source.validation),
    };
  });
}

function normalizeClarifications(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const source = isRecord(item) ? item : {};
    return {
      question: cleanText(source.question, `Clarification ${index + 1}`),
      answer: cleanText(source.answer, "No answer supplied."),
    };
  });
}

function normalizeDecisionGate(value: unknown) {
  const source = isRecord(value) ? value : {};
  return {
    proceed: cleanRequiredText(source.proceed, "proceed decision gate"),
    iterate: cleanRequiredText(source.iterate, "iterate decision gate"),
    kill: cleanRequiredText(source.kill, "kill decision gate"),
  };
}

function cleanStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const cleaned = value.map((item) => cleanOptionalText(item)).filter((item): item is string => Boolean(item));
  return cleaned;
}

function cleanText(value: unknown, fallback: string) {
  return cleanOptionalText(value) || fallback;
}

function cleanRequiredText(value: unknown, label: string) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) throw new Error(`Plan generation omitted ${label}.`);
  return cleaned;
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

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
}
