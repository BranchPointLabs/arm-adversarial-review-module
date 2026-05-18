export type JsonParseResult =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      error: string;
    };

export type JsonGraphNode = {
  id: string;
  label: string;
  path: string;
  kind: "object" | "array" | "value";
  explicitId?: string;
  data: unknown;
};

export type JsonGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: "contains" | "references";
  label?: string;
};

export type JsonGraph = {
  nodes: JsonGraphNode[];
  edges: JsonGraphEdge[];
  warnings: string[];
  hasExplicitSchema: boolean;
};

export function parseJsonDocument(content: string): JsonParseResult {
  try {
    return { ok: true, value: JSON.parse(content) };
  } catch (error: any) {
    return { ok: false, error: error?.message || "Invalid JSON." };
  }
}

export function extractGraphFromJson(value: unknown): JsonGraph {
  const warnings: string[] = [];
  const nodes: JsonGraphNode[] = [];
  const edges: JsonGraphEdge[] = [];
  const explicitIdToNodeId = new Map<string, string>();
  const referenceCandidates: Array<{ source: string; field: string; values: string[] }> = [];
  const pathCounts = new Map<string, number>();

  walkJson(value, {
    key: "root",
    path: "root",
    parentId: null,
    nodes,
    edges,
    explicitIdToNodeId,
    referenceCandidates,
    pathCounts,
    warnings,
  });

  for (const candidate of referenceCandidates) {
    for (const value of candidate.values) {
      const target = explicitIdToNodeId.get(value);
      if (!target) {
        warnings.push(`${candidate.field} references missing id "${value}".`);
        continue;
      }

      edges.push({
        id: uniqueEdgeId("references", candidate.source, target, candidate.field, edges.length),
        source: candidate.source,
        target,
        type: "references",
        label: candidate.field,
      });
    }
  }

  const explicitSchema = extractExplicitRelationshipSchema(value, explicitIdToNodeId, edges.length);
  if (explicitSchema) {
    warnings.push(...explicitSchema.warnings);
    edges.push(...explicitSchema.edges);
  }

  return {
    nodes,
    edges: dedupeEdges(edges),
    warnings,
    hasExplicitSchema: Boolean(explicitSchema),
  };
}

export const extractJsonGraph = extractGraphFromJson;

export function summarizeJsonDocument(content: string, maxRawChars = 5000) {
  const parsed = parseJsonDocument(content);
  if (!parsed.ok) {
    return {
      raw: content.slice(0, maxRawChars),
      summary: `Invalid JSON: ${parsed.error}`,
      warnings: [parsed.error],
    };
  }

  const graph = extractGraphFromJson(parsed.value);
  const topLevelKeys = isRecord(parsed.value) ? Object.keys(parsed.value) : [];
  const summary = [
    `Top-level keys: ${topLevelKeys.length > 0 ? topLevelKeys.join(", ") : "(none)"}`,
    `Graph nodes: ${graph.nodes.length}`,
    `Graph edges: ${graph.edges.length}`,
    graph.warnings.length > 0 ? `Validation warnings: ${graph.warnings.join("; ")}` : "Validation warnings: none",
  ].join("\n");

  return {
    raw: content.length <= maxRawChars ? content : null,
    summary,
    warnings: graph.warnings,
  };
}

function walkJson(
  value: unknown,
  context: {
    key: string;
    path: string;
    parentId: string | null;
    nodes: JsonGraphNode[];
    edges: JsonGraphEdge[];
    explicitIdToNodeId: Map<string, string>;
    referenceCandidates: Array<{ source: string; field: string; values: string[] }>;
    pathCounts: Map<string, number>;
    warnings: string[];
  },
) {
  const node = createNode(value, context.key, context.path, context.pathCounts);
  context.nodes.push(node);

  if (context.parentId) {
    context.edges.push({
      id: uniqueEdgeId("contains", context.parentId, node.id, context.key, context.edges.length),
      source: context.parentId,
      target: node.id,
      type: "contains",
      label: context.key,
    });
  }

  if (node.explicitId) {
    if (context.explicitIdToNodeId.has(node.explicitId)) {
      context.warnings.push(`Duplicate id "${node.explicitId}" found at ${node.path}.`);
    } else {
      context.explicitIdToNodeId.set(node.explicitId, node.id);
    }
  }

  if (isRecord(value)) {
    collectReferences(value, node.id, context.referenceCandidates);
    for (const [key, child] of Object.entries(value)) {
      if (isGraphableValue(child)) {
        walkJson(child, {
          ...context,
          key,
          path: pathForChild(context.path, key),
          parentId: node.id,
        });
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      if (!isGraphableValue(child)) return;
      walkJson(child, {
        ...context,
        key: String(index),
        path: `${context.path}[${index}]`,
        parentId: node.id,
      });
    });
  }
}

function createNode(value: unknown, key: string, path: string, pathCounts: Map<string, number>): JsonGraphNode {
  const explicitId = isRecord(value) ? normalizeString(value.id) || undefined : undefined;
  const baseId = explicitId || path;
  const count = pathCounts.get(baseId) || 0;
  pathCounts.set(baseId, count + 1);
  const id = count === 0 ? baseId : `${baseId}#${count + 1}`;
  const kind = Array.isArray(value) ? "array" : isRecord(value) ? "object" : "value";

  return {
    id,
    label: labelForNode(value, key, path, explicitId),
    path,
    kind,
    explicitId,
    data: value,
  };
}

function collectReferences(
  value: Record<string, unknown>,
  source: string,
  referenceCandidates: Array<{ source: string; field: string; values: string[] }>,
) {
  for (const [field, rawValue] of Object.entries(value)) {
    if (/Id$/.test(field) && typeof rawValue === "string" && rawValue.trim()) {
      referenceCandidates.push({ source, field, values: [rawValue.trim()] });
    }

    if (/Ids$/.test(field) && Array.isArray(rawValue)) {
      const values = rawValue.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
      if (values.length > 0) {
        referenceCandidates.push({ source, field, values });
      }
    }
  }
}

function extractExplicitRelationshipSchema(
  value: unknown,
  explicitIdToNodeId: Map<string, string>,
  edgeOffset: number,
): { edges: JsonGraphEdge[]; warnings: string[] } | null {
  if (!isRecord(value) || !Array.isArray(value.entities) || !Array.isArray(value.relationships)) return null;

  const warnings: string[] = [];
  const edges: JsonGraphEdge[] = [];
  value.relationships.forEach((relationship, index) => {
    if (!isRecord(relationship)) {
      warnings.push(`Relationship ${index + 1} is not an object.`);
      return;
    }

    const sourceId = normalizeString(relationship.from);
    const targetId = normalizeString(relationship.to);
    if (!sourceId || !targetId) {
      warnings.push(`Relationship ${index + 1} is missing from or to.`);
      return;
    }

    const source = explicitIdToNodeId.get(sourceId);
    const target = explicitIdToNodeId.get(targetId);
    if (!source) warnings.push(`Relationship ${index + 1} references missing source "${sourceId}".`);
    if (!target) warnings.push(`Relationship ${index + 1} references missing target "${targetId}".`);
    if (!source || !target) return;

    const label = normalizeString(relationship.label) || normalizeString(relationship.type) || "relationship";
    edges.push({
      id: uniqueEdgeId("references", source, target, label, edgeOffset + index),
      source,
      target,
      type: "references",
      label,
    });
  });

  return { edges, warnings };
}

function labelForNode(value: unknown, key: string, path: string, explicitId?: string) {
  if (isRecord(value)) {
    return normalizeString(value.label) || normalizeString(value.name) || explicitId || key || path;
  }
  if (Array.isArray(value)) {
    return key === "root" ? "root" : `${key} [${value.length}]`;
  }
  return key || path;
}

function pathForChild(path: string, key: string) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}.${JSON.stringify(key)}`;
}

function isGraphableValue(value: unknown) {
  return Boolean(value && typeof value === "object");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueEdgeId(type: string, source: string, target: string, label: string, index: number) {
  return `${type}:${source}->${target}:${label}:${index}`;
}

function dedupeEdges(edges: JsonGraphEdge[]) {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.type}:${edge.source}:${edge.target}:${edge.label || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
