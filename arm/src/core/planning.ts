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
      question: mode === "kill" ? "What specific evidence would make you stop building this?" : "What exact user or business outcome should this plan achieve?",
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
  const outcome = answerFor(answered, "outcome", args.mode);
  const constraint = answerFor(answered, "constraint", args.mode);
  const signal = answerFor(answered, "signal", args.mode);
  const sourceSummary = summarizeSources(args.documents, args.cards);
  const planSignals = extractPlanSignals(args.documents, args.cards, outcome);
  const initiatives = buildInitiatives({
    mode: args.mode,
    outcome,
    constraint,
    signal,
    sourceSummary,
    planSignals,
  });

  return ensureTrailingNewline(
    [
      `# ${args.title}`,
      "",
      "## Plan Summary",
      `**Plan type:** ${args.mode === "kill" ? "Kill Plan" : "Focused Delivery Plan"}`,
      `**Business outcome:** ${outcome}`,
      `**Mandate:** ${args.mode === "kill" ? "Find the cheapest invalidating evidence before investing further." : "Deliver the smallest credible product slice that can prove or disprove the outcome."}`,
      `**Audience:** solo builder / small team execution plan.`,
      `**Delivery constraint:** ${constraint}`,
      `**Decision signal:** ${signal}`,
      "",
      "### Planning Context",
      args.context.trim() || "- No additional context supplied.",
      "",
      "### Source Synthesis",
      ...sourceSummary.map((item) => `- ${item}`),
      "",
      "### Clarifications",
      ...answered.map((question) => `- **${question.question}:** ${question.finalAnswer}`),
      "",
      "### Execution Strategy",
      "- Keep the plan high-level and implementation-independent.",
      "- Each initiative, epic, and ticket has one responsibility and one clear success condition.",
      "- Engineers may choose any implementation approach that satisfies the stated goal and success requirements.",
      "- Use the decision signal as the release gate, not as a vague aspiration.",
      "",
      "```mermaid",
      "flowchart LR",
      ...buildInitiativeOverviewMermaid(initiatives),
      "```",
      "",
      "## Initiatives",
      ...initiatives.map((initiative) => initiative.initiativeMarkdown).flat(),
      "",
      "## Epics",
      ...initiatives.map((initiative) => initiative.epicsMarkdown).flat(),
      "",
      "## Tickets",
      ...initiatives.map((initiative) => initiative.ticketsMarkdown).flat(),
      "",
      "## QA Review",
      "",
      "### QA Objective",
      "- Validate each work item against its stated user or business outcome.",
      "- Confirm the full user journey can be completed without hidden assumptions.",
      "- Check that failure, confusion, or incomplete input has a clear recovery path.",
      "- Confirm no completed item depends on a specific technical approach unless explicitly required.",
      "- Run one end-to-end acceptance pass before using the proceed / iterate / kill gate.",
      "",
      "### End-to-End Test Scenarios",
      "- **Happy path:** Validate the shortest complete user journey from start to finish.",
      "- **Recovery path:** Validate that incomplete input, confusion, or interruption can be corrected.",
      "- **Decision path:** Validate that captured evidence is enough to choose proceed, iterate, or kill.",
      "",
      "### Ticket Acceptance Matrix",
      "- Use each ticket's requirements and validation criteria as the acceptance checklist.",
      "- Record evidence for any ticket that influences the decision signal.",
      "",
      "### Delivery Milestones",
      "- **Milestone 1:** Scope is clear enough that implementation choices can be made confidently.",
      "- **Milestone 2:** The core user journey is complete enough to evaluate.",
      "- **Milestone 3:** Evidence exists to decide proceed, iterate, or kill.",
      "",
      "### Decision After Execution",
      `- [ ] **Proceed:** ${signal} is met and no critical usability or reliability blocker remains.`,
      "- [ ] **Iterate:** users can complete the workflow, but the signal is weak or feedback identifies one focused improvement.",
      "- [ ] **Kill:** the workflow cannot produce meaningful user value within the stated constraint.",
      "",
    ].join("\n"),
  );
}

function answerFor(answers: Array<PlanQuestion & { finalAnswer: string }>, id: string, mode: PlanMode) {
  return answers.find((question) => question.id === id)?.finalAnswer || defaultAnswerForQuestion(id, mode);
}

function summarizeSources(documents: ProjectDocument[], cards: AgentCard[]) {
  const documentSummaries = documents.slice(0, 4).map((document) => {
    const firstLine = firstMeaningfulLine(document.markdown) || "Selected as a planning source.";
    return `${document.type}: ${document.name} - ${trimSentence(firstLine, 180)}`;
  });
  const cardSummaries = cards.slice(0, 4).map((card) =>
    `${card.sourceAgent}: ${card.title} - ${trimSentence(card.body, 180)}`,
  );
  return [...documentSummaries, ...cardSummaries].slice(0, 6);
}

function extractPlanSignals(documents: ProjectDocument[], cards: AgentCard[], outcome: string) {
  const lines = documents
    .flatMap((document) => document.markdown.split("\n"))
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter((line) => line.length > 8 && !line.startsWith("#"))
    .filter((line) => !/^source:|^why:|^action:|^success signal:/i.test(line));
  const cardLines = cards.flatMap((card) => [card.title, card.proposedUpdate || card.body]);
  const candidates = dedupeText([...lines, ...cardLines, outcome])
    .map((line) => trimSentence(line, 140))
    .filter(Boolean);
  return candidates.length > 0 ? candidates.slice(0, 9) : ["Create the smallest complete workflow that proves the product can deliver value."];
}

function buildInitiatives(args: {
  mode: PlanMode;
  outcome: string;
  constraint: string;
  signal: string;
  sourceSummary: string[];
  planSignals: string[];
}) {
  const initiativeBlueprints = [
    {
      title: "Product Spine and Scope Lock",
      objective: "Define the smallest coherent product promise, audience, and success boundary before implementation begins.",
      epics: [
        {
          title: "Clarify the product promise",
          tickets: [
            ticket(
              "State the target outcome",
              `Create a shared definition of the outcome: ${args.outcome}.`,
              [
                "The outcome is written in user or business language.",
                "The outcome can be evaluated without knowing the implementation.",
                `The outcome is realistic under the constraint: ${args.constraint}.`,
              ],
              [
                "A reviewer can explain what success means in one sentence.",
                "The outcome excludes at least one tempting but non-essential scope item.",
              ],
            ),
            ticket(
              "Define the decision gate",
              `Translate the measurable result into proceed, iterate, and kill conditions: ${args.signal}.`,
              [
                "Proceed, iterate, and kill each have a distinct meaning.",
                "Each condition is based on observable evidence.",
                "The decision can be made without debating technical implementation details.",
              ],
              [
                "A stakeholder can use the gate to make a decision after execution.",
                "The gate prevents the plan from becoming open-ended work.",
              ],
            ),
          ],
        },
        {
          title: "Set the product boundary",
          tickets: [
            ticket(
              "Identify the essential user journey",
              `Describe the shortest journey that proves the product can deliver: ${args.planSignals[0]}.`,
              [
                "The journey has a clear beginning, middle, and successful end.",
                "Every step contributes directly to the target outcome.",
                "Non-essential capabilities are deferred.",
              ],
              [
                "A user can understand what they are expected to do.",
                "An engineer can choose any implementation that preserves the journey.",
              ],
            ),
            ticket(
              "Name assumptions and risks",
              "Capture the assumptions that could make the plan wrong or too broad.",
              [
                "Assumptions are written plainly.",
                "Each assumption has a lightweight validation method.",
                "High-risk assumptions are visible before implementation starts.",
              ],
              [
                "The team can identify what must be true for the plan to work.",
                "The plan can be revised without rewriting the entire breakdown.",
              ],
            ),
          ],
        },
      ],
    },
    {
      title: "End-to-End User Workflow",
      objective: "Deliver one complete user journey that creates real value without relying on future work to feel complete.",
      epics: [
        {
          title: "Make the primary journey usable",
          tickets: [
            ticket(
              "Enable the first meaningful user action",
              `Let the user take the first action that moves them toward: ${args.outcome}.`,
              [
                "The action is obvious to the intended user.",
                "The action collects only information needed for the core journey.",
                "The user receives clear feedback after completing it.",
              ],
              [
                "A new user can complete the action without developer guidance.",
                "Incomplete or invalid input is handled in a recoverable way.",
              ],
            ),
            ticket(
              "Show the user a useful result",
              "Present the outcome of the journey in a way the user can evaluate and act on.",
              [
                "The result clearly reflects the user's input or intent.",
                "The result supports the next natural user decision.",
                "The result remains understandable without technical context.",
              ],
              [
                "A user can tell whether the result is useful.",
                "The result can be revisited or reviewed as needed.",
              ],
            ),
          ],
        },
        {
          title: "Support correction and continuity",
          tickets: [
            ticket(
              "Allow meaningful revision",
              "Let the user correct or refine their work without losing progress.",
              [
                "The user can identify what will change before committing.",
                "Unchanged work remains intact.",
                "A failed revision does not erase user input.",
              ],
              [
                "The user can recover from a mistake.",
                "The revision flow supports the same core outcome as the initial flow.",
              ],
            ),
            ticket(
              "Preserve user continuity",
              "Ensure the user can leave and return without losing the meaning of their work.",
              [
                "The latest version of the work is what the user sees.",
                "The user can distinguish current work from old or incomplete work.",
                "Returning to the journey does not require re-entering known information.",
              ],
              [
                "A user can resume the journey after interruption.",
                "The product does not present stale work as current.",
              ],
            ),
          ],
        },
      ],
    },
    {
      title: "Validation, Release, and Learning Loop",
      objective: "Evaluate the completed journey against the decision signal and turn the result into a clear next decision.",
      epics: [
        {
          title: "Validate the experience",
          tickets: [
            ticket(
              "Evaluate the full journey",
              "Review the product from the user's perspective, not from the implementation perspective.",
              [
                "The journey can be completed end to end.",
                "The user-facing value is clear at the end of the journey.",
                "Confusing or incomplete moments are documented.",
              ],
              [
                "A reviewer can run the journey and explain the value delivered.",
                "Any blocker is classified as launch-blocking or follow-up.",
              ],
            ),
            ticket(
              "Confirm readiness against constraints",
              `Check whether the work is good enough under the constraint: ${args.constraint}.`,
              [
                "Remaining work is separated into must-have and later work.",
                "Known tradeoffs are explicit.",
                "The release candidate is small enough to evaluate honestly.",
              ],
              [
                "The plan can stop at this point and still be evaluated.",
                "The next decision does not depend on hidden extra scope.",
              ],
            ),
          ],
        },
        {
          title: "Measure and decide",
          tickets: [
            ticket(
              "Collect decision evidence",
              `Gather evidence for the measurable result: ${args.signal}.`,
              [
                "The evidence source is identified before evaluation.",
                "Evidence can distinguish user confusion from lack of value.",
                "Evidence is tied to the original outcome.",
              ],
              [
                "The evidence is specific enough to support a decision.",
                "The result can be compared against the proceed / iterate / kill gate.",
              ],
            ),
            ticket(
              "Make the next decision",
              "Use the evidence to choose one explicit next direction.",
              [
                "The decision uses the signal threshold, not effort invested.",
                "The next action is one of proceed, iterate, or kill.",
                "If iterating, exactly one improvement theme is selected.",
              ],
              [
                "The decision is understandable to someone who did not build the product.",
                "The next step follows directly from the evidence.",
              ],
            ),
          ],
        },
      ],
    },
  ];

  return initiativeBlueprints.map((initiative, initiativeIndex) => {
    const source = args.sourceSummary[initiativeIndex] || args.sourceSummary[0] || "Selected planning sources.";
    const initiativeId = `I${initiativeIndex + 1}`;
    const epicIds = initiative.epics.map((_, epicIndex) => `${initiativeId}E${epicIndex + 1}`);
    const initiativeMarkdown = [
      `### Initiative ${initiativeIndex + 1}: ${initiative.title}`,
      `**Goal:** ${initiative.objective}`,
      `**Single responsibility:** ${singleResponsibilityForInitiative(initiative.title)}`,
      `**Evaluation:** ${initiativeIndex === 2 ? args.signal : `This initiative advances "${args.outcome}" without prescribing implementation details.`}`,
      `**Source signal:** ${source}`,
      "",
      "```mermaid",
      "flowchart TD",
      `  ${initiativeId}["${escapeMermaidLabel(`${initiative.title}<br/>Target: ${initiative.objective}`)}"]`,
      ...initiative.epics.map((epic, epicIndex) => `  ${epicIds[epicIndex]}["${escapeMermaidLabel(`${epic.title}<br/>Target: ${epicGoal(epic.title)}`)}"]`),
      ...epicIds.map((epicId) => `  ${initiativeId} --> ${epicId}`),
      "```",
      "",
    ];

    const epicsMarkdown = initiative.epics.flatMap((epic, epicIndex) => {
      const epicNumber = `${initiativeIndex + 1}.${epicIndex + 1}`;
      const epicId = epicIds[epicIndex];
      const ticketIds = epic.tickets.map((_, ticketIndex) => `${epicId}T${ticketIndex + 1}`);
      return [
        `### Epic ${epicNumber}: ${epic.title}`,
        `**Parent initiative:** ${initiative.title}`,
        `**Goal:** ${epicGoal(epic.title)}`,
        `**Single responsibility:** ${epicResponsibility(epic.title)}`,
        "",
        "```mermaid",
        "flowchart TD",
        `  ${epicId}["${escapeMermaidLabel(`${epic.title}<br/>Target: ${epicGoal(epic.title)}`)}"]`,
        ...epic.tickets.map((item, ticketIndex) => `  ${ticketIds[ticketIndex]}["${escapeMermaidLabel(`${item.title}<br/>Target: ${item.goal}`)}"]`),
        ...ticketIds.map((ticketId) => `  ${epicId} --> ${ticketId}`),
        "```",
        "",
      ];
    });

    const ticketsMarkdown = initiative.epics.flatMap((epic, epicIndex) =>
      epic.tickets.flatMap((item, ticketIndex) =>
        formatTicket(item, initiativeIndex + 1, epicIndex + 1, ticketIndex + 1, initiative.title, epic.title),
      ),
    );

    return { initiativeMarkdown, epicsMarkdown, ticketsMarkdown };
  });
}

function singleResponsibilityForInitiative(title: string) {
  if (title.startsWith("Product")) return "Decide what is being built and what success means.";
  if (title.startsWith("End-to-End")) return "Make the core user journey valuable and complete.";
  return "Determine whether the completed work should proceed, iterate, or stop.";
}

function buildInitiativeOverviewMermaid(
  initiatives: Array<{ initiativeMarkdown: string[]; epicsMarkdown: string[]; ticketsMarkdown: string[] }>,
) {
  const labels = initiatives.map((initiative, index) => {
    const title = /^### Initiative \d+:\s+(.+)$/m.exec(initiative.initiativeMarkdown.join("\n"))?.[1] || `Initiative ${index + 1}`;
    const target = /^(?:\*\*Goal:\*\*|Goal:)\s+(.+)$/m.exec(initiative.initiativeMarkdown.join("\n"))?.[1] || "Advance the plan.";
    return { id: `I${index + 1}`, title, target };
  });

  const edges = labels.length >= 3
    ? [
        "  I1 -->|enables| I2",
        "  I1 -->|informs| I3",
        "  I2 -->|validates| I3",
      ]
    : labels.slice(1).map((label) => `  I1 -->|enables| ${label.id}`);

  return [
    ...labels.map((label) => `  ${label.id}["${escapeMermaidLabel(`${label.title}<br/>Target: ${label.target}`)}"]`),
    ...edges,
  ];
}

function ticket(title: string, goal: string, requirements: string[], success: string[]) {
  return { title, goal, requirements, success };
}

function formatTicket(
  item: { title: string; goal: string; requirements: string[]; success: string[] },
  initiativeIndex: number,
  epicIndex: number,
  ticketIndex: number,
  initiativeTitle: string,
  epicTitle: string,
) {
  return [
    `#### Ticket ${initiativeIndex}.${epicIndex}.${ticketIndex}: ${item.title}`,
    `**Parent initiative:** ${initiativeTitle}`,
    `**Parent epic:** ${epicTitle}`,
    `**Goal:** ${item.goal}`,
    "",
    "**Requirements for success:**",
    ...item.requirements.map((criterion) => `- ${criterion}`),
    "",
    "**Validation criteria:**",
    ...item.success.map((criterion) => `- ${criterion}`),
    "",
  ];
}

function epicGoal(title: string) {
  if (title.includes("promise")) return "Make the product intent clear enough to evaluate.";
  if (title.includes("boundary")) return "Separate essential scope from deferred scope.";
  if (title.includes("journey")) return "Make the core user path understandable and useful.";
  if (title.includes("correction")) return "Let users recover and continue without losing meaning.";
  if (title.includes("experience")) return "Confirm the journey delivers user-facing value.";
  return "Use evidence to choose the next direction.";
}

function epicResponsibility(title: string) {
  if (title.includes("promise")) return "Define the promise.";
  if (title.includes("boundary")) return "Define the boundary.";
  if (title.includes("journey")) return "Complete the main journey.";
  if (title.includes("correction")) return "Support continuity.";
  if (title.includes("experience")) return "Validate usefulness.";
  return "Make the decision.";
}

function escapeMermaidLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

function dedupeText(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function trimSentence(value: string, maxLength = 220) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3)}...` : cleaned;
}

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
}
