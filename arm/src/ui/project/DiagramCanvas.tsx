import { DiagramEntity } from "../../core/projectStore";

type RenderedDiagramNode = {
  id: string;
  name: string;
  responsibility: string;
};

export default function DiagramCanvas(props: { entities: DiagramEntity[]; mermaid: string }) {
  const parsed = parseMermaidDiagram(props.mermaid);
  const nodes = parsed.nodes.length > 0
    ? parsed.nodes
    : props.entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        responsibility: entity.responsibility,
      }));
  const relationships = parsed.nodes.length > 0
    ? parsed.relationships
    : props.entities.flatMap((entity) =>
        entity.collaborators.map((collaboratorId) => ({
          sourceId: entity.id,
          targetId: collaboratorId,
        })),
      );

  if (nodes.length === 0) {
    return (
      <div className="diagramEmpty">
        <div className="surfaceTitle">No cards yet</div>
        <div className="surfaceCopy">Add a card to create the first diagram entity.</div>
      </div>
    );
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const renderedRelationships = relationships
    .map((relationship) => ({
      source: nodeById.get(relationship.sourceId),
      target: nodeById.get(relationship.targetId),
    }))
    .filter((relationship): relationship is { source: RenderedDiagramNode; target: RenderedDiagramNode } =>
      Boolean(relationship.source && relationship.target),
    );
  const connectedIds = new Set(renderedRelationships.flatMap((relationship) => [relationship.source.id, relationship.target.id]));
  const standalone = nodes.filter((node) => !connectedIds.has(node.id));

  return (
    <div className="diagramCanvas" aria-label="Rendered Mermaid diagram">
      {renderedRelationships.map((relationship) => (
        <div key={`${relationship.source.id}-${relationship.target.id}`} className="diagramRelationship">
          <DiagramNode node={relationship.source} />
          <div className="diagramArrow" aria-hidden="true" />
          <DiagramNode node={relationship.target} />
        </div>
      ))}
      {standalone.length > 0 ? (
        <div className="diagramStandalone">
          {standalone.map((node) => (
            <DiagramNode key={node.id} node={node} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DiagramNode(props: { node: RenderedDiagramNode }) {
  const responsibilities = splitResponsibilities(props.node.responsibility);

  return (
    <div className="diagramNode">
      <div className="diagramNodeName">{props.node.name}</div>
      <div className="diagramNodeResponsibility">
        {responsibilities.length > 1 ? "Responsibilities:" : "Responsibility:"}
        {responsibilities.length > 0 ? (
          <ul className="diagramResponsibilityList">
            {responsibilities.map((responsibility) => (
              <li key={responsibility}>{responsibility}</li>
            ))}
          </ul>
        ) : (
          " Unassigned"
        )}
      </div>
    </div>
  );
}

function parseMermaidDiagram(mermaid: string): {
  nodes: RenderedDiagramNode[];
  relationships: Array<{ sourceId: string; targetId: string }>;
} {
  const nodes = new Map<string, RenderedDiagramNode>();
  const relationships: Array<{ sourceId: string; targetId: string }> = [];

  for (const line of mermaid.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("flowchart") || trimmed.startsWith("graph")) continue;

    const relationshipMatch = /^([A-Za-z0-9_:-]+)\s*-->\s*([A-Za-z0-9_:-]+)/.exec(trimmed);
    if (relationshipMatch) {
      relationships.push({ sourceId: relationshipMatch[1], targetId: relationshipMatch[2] });
      continue;
    }

    const nodeMatch = /^([A-Za-z0-9_:-]+)\s*\[\s*"([^"]*)"\s*\]/.exec(trimmed);
    if (nodeMatch) {
      const label = nodeMatch[2].replace(/<br\s*\/?>/gi, "\n").replace(/\\"/g, '"');
      const lines = label.split(/\n+/).map((item) => item.trim()).filter(Boolean);
      nodes.set(nodeMatch[1], {
        id: nodeMatch[1],
        name: lines[0] || nodeMatch[1],
        responsibility: extractResponsibilities(lines),
      });
    }
  }

  for (const relationship of relationships) {
    if (!nodes.has(relationship.sourceId)) {
      nodes.set(relationship.sourceId, { id: relationship.sourceId, name: relationship.sourceId, responsibility: "" });
    }
    if (!nodes.has(relationship.targetId)) {
      nodes.set(relationship.targetId, { id: relationship.targetId, name: relationship.targetId, responsibility: "" });
    }
  }

  return { nodes: [...nodes.values()], relationships };
}

function extractResponsibilities(lines: string[]) {
  const responsibilityIndex = lines.findIndex((item) => item.toLowerCase().startsWith("responsibility:"));
  if (responsibilityIndex === -1) return "";

  return lines
    .slice(responsibilityIndex)
    .map((item, index) => (index === 0 ? item.replace(/^responsibility:\s*/i, "") : item))
    .flatMap((item) => splitResponsibilities(item))
    .join("\n");
}

function splitResponsibilities(value: string) {
  return value
    .split(/\r?\n|[;•]/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}
