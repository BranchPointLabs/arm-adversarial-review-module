type PlanDiagramNode = {
  id: string;
  title: string;
  target: string;
};

export default function PlanDiagramCanvas(props: { mermaid: string; title: string; context: string }) {
  const parsed = parsePlanMermaidDiagram(props.mermaid, props.context, props.title);
  const root = parsed.nodes.find((node) => parsed.relationships.some((relationship) => relationship.sourceId === node.id));
  const children = root
    ? parsed.relationships
        .filter((relationship) => relationship.sourceId === root.id)
        .map((relationship) => parsed.nodes.find((node) => node.id === relationship.targetId))
        .filter((node): node is PlanDiagramNode => Boolean(node))
    : parsed.nodes.slice(1);

  if (!root) {
    return (
      <div className="diagramEmpty">
        <div className="surfaceTitle">No diagram data</div>
        <div className="surfaceCopy">This plan diagram has no readable parent and child work items.</div>
      </div>
    );
  }

  return (
    <div className="planDiagramCanvas" aria-label="Plan relationship diagram">
      <PlanWorkCard node={root} emphasis="parent" />
      <div className="planDiagramFanout" aria-hidden="true" />
      <div className="planDiagramChildren">
        {children.map((child) => (
          <div key={child.id} className="planDiagramChildRow">
            <div className="planDiagramArrow" aria-hidden="true" />
            <PlanWorkCard node={child} emphasis="child" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanWorkCard(props: { node: PlanDiagramNode; emphasis: "parent" | "child" }) {
  return (
    <div className={"planWorkCard " + props.emphasis}>
      <div className="planWorkCardTitle">{props.node.title}</div>
      <div className="planWorkCardTarget">{props.node.target || "Target: define the outcome of this block of work."}</div>
    </div>
  );
}

function parsePlanMermaidDiagram(mermaid: string, context: string, diagramTitle: string): {
  nodes: PlanDiagramNode[];
  relationships: Array<{ sourceId: string; targetId: string }>;
} {
  const nodes = new Map<string, PlanDiagramNode>();
  const relationships: Array<{ sourceId: string; targetId: string }> = [];
  const inferred = inferPlanDiagramLabels(context, diagramTitle);

  for (const line of mermaid.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("flowchart") || trimmed.startsWith("graph")) continue;

    for (const nodeMatch of trimmed.matchAll(/([A-Za-z0-9_:-]+)\s*\[\s*"?([^"\]]+)"?\s*\]/g)) {
      nodes.set(nodeMatch[1], {
        id: nodeMatch[1],
        ...parsePlanNodeLabel(nodeMatch[2], nodeMatch[1]),
      });
    }

    const relationshipMatch = /^([A-Za-z0-9_:-]+)(?:\s*\[[^\]]+\])?\s*-->(?:\|[^|]+\|)?\s*([A-Za-z0-9_:-]+)/.exec(trimmed);
    if (relationshipMatch) {
      relationships.push({ sourceId: relationshipMatch[1], targetId: relationshipMatch[2] });
    }
  }

  const sourceIds = new Set(relationships.map((relationship) => relationship.sourceId));
  const targetIds = new Set(relationships.map((relationship) => relationship.targetId));
  const rootId = [...sourceIds].find((id) => !targetIds.has(id)) || relationships[0]?.sourceId || "";
  const childIds = relationships.filter((relationship) => relationship.sourceId === rootId).map((relationship) => relationship.targetId);

  for (const relationship of relationships) {
    if (!nodes.has(relationship.sourceId)) {
      nodes.set(relationship.sourceId, {
        id: relationship.sourceId,
        ...labelForPlanNode(relationship.sourceId, inferred, rootId, childIds),
      });
    }
    if (!nodes.has(relationship.targetId)) {
      nodes.set(relationship.targetId, {
        id: relationship.targetId,
        ...labelForPlanNode(relationship.targetId, inferred, rootId, childIds),
      });
    }
  }

  for (const node of nodes.values()) {
    if (isGenericPlanNode(node)) {
      const label = labelForPlanNode(node.id, inferred, rootId, childIds);
      node.title = label.title;
      node.target = label.target;
    }
  }

  if (relationships.length === 0) {
    return buildFallbackPlanDiagram(context, diagramTitle);
  }

  return { nodes: [...nodes.values()], relationships };
}

function buildFallbackPlanDiagram(context: string, diagramTitle: string): {
  nodes: PlanDiagramNode[];
  relationships: Array<{ sourceId: string; targetId: string }>;
} {
  const inferred = inferPlanDiagramLabels(context, diagramTitle);
  const cleanedTitle = normalizePlanTitle(inferred.cleanedTitle);

  if (/initiative relationship/i.test(diagramTitle)) {
    const nodes = inferred.initiatives.slice(0, 4).map((item, index) => ({
      id: `I${index + 1}`,
      ...planItemLabel(item),
    }));
    return {
      nodes,
      relationships: nodes.slice(1).map((node, index) => ({
        sourceId: index === 0 ? nodes[0].id : nodes[index].id,
        targetId: node.id,
      })),
    };
  }

  const initiative = inferred.initiatives.find((item) => normalizePlanTitle(item.title) === cleanedTitle)
    || inferred.initiatives.find((item) => cleanedTitle.includes(normalizePlanTitle(item.title)) || normalizePlanTitle(item.title).includes(cleanedTitle));
  if (initiative) {
    const children = inferred.epics.filter((item) => item.number.startsWith(`${initiative.number}.`));
    const nodes = [
      { id: "parent", ...planItemLabel(initiative) },
      ...children.map((item, index) => ({ id: `child${index + 1}`, ...planItemLabel(item) })),
    ];
    return {
      nodes,
      relationships: nodes.slice(1).map((node) => ({ sourceId: "parent", targetId: node.id })),
    };
  }

  const epic = inferred.epics.find((item) => normalizePlanTitle(item.title) === cleanedTitle)
    || inferred.epics.find((item) => cleanedTitle.includes(normalizePlanTitle(item.title)) || normalizePlanTitle(item.title).includes(cleanedTitle));
  if (epic) {
    const children = inferred.tickets.filter((item) => item.number.startsWith(`${epic.number}.`));
    const nodes = [
      { id: "parent", ...planItemLabel(epic) },
      ...children.map((item, index) => ({ id: `child${index + 1}`, ...planItemLabel(item) })),
    ];
    return {
      nodes,
      relationships: nodes.slice(1).map((node) => ({ sourceId: "parent", targetId: node.id })),
    };
  }

  return { nodes: [], relationships: [] };
}

function inferPlanDiagramLabels(context: string, diagramTitle: string) {
  const cleanedTitle = diagramTitle.replace(/\s+Diagram$/i, "").trim();
  const initiatives = extractNumberedPlanItems(context, "Initiative");
  const epics = extractNumberedPlanItems(context, "Epic");
  const tickets = extractNumberedPlanItems(context, "Ticket");
  const matchingInitiative = initiatives.find((item) => samePlanTitle(item.title, cleanedTitle));
  const matchingEpic = epics.find((item) => samePlanTitle(item.title, cleanedTitle));

  return { cleanedTitle, initiatives, epics, tickets, matchingInitiative, matchingEpic };
}

function labelForPlanNode(
  id: string,
  inferred: ReturnType<typeof inferPlanDiagramLabels>,
  rootId = "",
  childIds: string[] = [],
): { title: string; target: string } {
  if (id === rootId) {
    const rootItem = inferred.matchingEpic || inferred.matchingInitiative || inferred.initiatives[0];
    if (rootItem) return planItemLabel(rootItem);
  }

  const childIndex = childIds.indexOf(id);
  if (childIndex >= 0) {
    if (inferred.matchingEpic) {
      const scopedTickets = inferred.tickets.filter((item) => item.number.startsWith(`${inferred.matchingEpic?.number}.`));
      const item = scopedTickets[childIndex] || inferred.tickets[childIndex];
      if (item) return planItemLabel(item);
    }
    if (inferred.matchingInitiative) {
      const scopedEpics = inferred.epics.filter((item) => item.number.startsWith(`${inferred.matchingInitiative?.number}.`));
      const item = scopedEpics[childIndex] || inferred.epics[childIndex];
      if (item) return planItemLabel(item);
    }
    const overviewItem = inferred.initiatives[childIndex + (rootId ? 1 : 0)] || inferred.initiatives[childIndex];
    if (overviewItem) return planItemLabel(overviewItem);
  }

  const initiativeMatch = /^A?I?(\d+)$/i.exec(id);
  if (initiativeMatch) {
    const item = inferred.initiatives[Number(initiativeMatch[1]) - 1] || inferred.matchingInitiative;
    return item ? planItemLabel(item) : { title: inferred.cleanedTitle || humanizeMermaidId(id), target: "" };
  }

  const epicMatch = /^E(\d+)$|^I?(\d+)E(\d+)$/i.exec(id);
  if (epicMatch) {
    const epicNumber = Number(epicMatch[1] || epicMatch[3]);
    const matchingInitiative = inferred.matchingInitiative;
    const scopedEpics = matchingInitiative
      ? inferred.epics.filter((item) => item.number.startsWith(`${matchingInitiative.number}.`))
      : inferred.epics;
    const item = scopedEpics[epicNumber - 1] || inferred.epics[epicNumber - 1];
    return item ? planItemLabel(item) : { title: humanizeMermaidId(id), target: "" };
  }

  const ticketMatch = /^T(\d+)$|^I?(\d+)E(\d+)T(\d+)$/i.exec(id);
  if (ticketMatch) {
    const ticketNumber = Number(ticketMatch[1] || ticketMatch[4]);
    const matchingEpic = inferred.matchingEpic;
    const scopedTickets = matchingEpic
      ? inferred.tickets.filter((item) => item.number.startsWith(`${matchingEpic.number}.`))
      : inferred.tickets;
    const item = scopedTickets[ticketNumber - 1] || inferred.tickets[ticketNumber - 1];
    return item ? planItemLabel(item) : { title: humanizeMermaidId(id), target: "" };
  }

  return { title: humanizeMermaidId(id), target: "" };
}

function isGenericPlanNode(node: PlanDiagramNode) {
  return /^[A-Z]\d*$/i.test(node.title.trim()) || !node.target.trim();
}

function extractNumberedPlanItems(context: string, kind: "Initiative" | "Epic" | "Ticket") {
  const explicitPattern = new RegExp(`^\\s*(?:[-*]\\s*)?(?:#{3,5}\\s*)?(?:\\*\\*)?${kind}\\s+([\\d.]+)\\s*(?::|-|\\.|\\))\\s*(.+?)(?:\\*\\*)?\\s*$`, "gim");
  const matches = [...context.matchAll(explicitPattern)];
  if (matches.length === 0) {
    const section = sectionForPlanKind(context, kind);
    const numberedPattern = /^#{3,5}\s+([\d.]+)\s*(?::|-|\.|\))\s*(.+)$/gim;
    return [...section.matchAll(numberedPattern)]
      .filter((match) => numberMatchesPlanKind(match[1], kind))
      .map((match) => extractedNumberedPlanItem(section, match));
  }

  return matches.map((match) => extractedNumberedPlanItem(context, match));
}

function extractedNumberedPlanItem(context: string, match: RegExpMatchArray) {
  const start = match.index || 0;
  const nextHeading = context.slice(start + match[0].length).search(/^#{3,5}\s+|\n\s*(?:[-*]\s*)?(?:\*\*)?(?:Initiative|Epic|Ticket)\s+[\d.]+\s*(?::|-|\.|\))/m);
  const end = nextHeading === -1 ? context.length : start + match[0].length + nextHeading;
  const block = context.slice(start, end);
  const target = /(?:Goal|Target):\s*(.+)/i.exec(block)?.[1]?.trim() || "";
  return {
    number: match[1],
    title: match[2].trim(),
    target,
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

function planItemLabel(item: { title: string; target: string }) {
  return {
    title: item.title,
    target: item.target || "Define the outcome of this block of work.",
  };
}

function samePlanTitle(left: string, right: string) {
  return normalizePlanTitle(left) === normalizePlanTitle(right);
}

function normalizePlanTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parsePlanNodeLabel(rawLabel: string, fallback: string) {
  const label = rawLabel.replace(/<br\s*\/?>/gi, "\n").replace(/\\"/g, '"');
  const parts = label.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const targetLine = parts.find((part) => /^target:/i.test(part));
  return {
    title: parts[0] || humanizeMermaidId(fallback),
    target: targetLine?.replace(/^target:\s*/i, "") || parts.slice(1).join(" ") || "",
  };
}

function humanizeMermaidId(value: string) {
  return value.replace(/^I(\d+)E?(\d+)?T?(\d+)?$/i, (_match, initiative, epic, ticket) => {
    if (ticket) return `Ticket ${initiative}.${epic}.${ticket}`;
    if (epic) return `Epic ${initiative}.${epic}`;
    return `Initiative ${initiative}`;
  });
}
