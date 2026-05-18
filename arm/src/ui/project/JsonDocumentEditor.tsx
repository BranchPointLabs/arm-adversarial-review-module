import React from "react";
import { extractGraphFromJson, JsonGraph, parseJsonDocument } from "../../core/jsonDocument";
import { ProjectDocument } from "../../core/projectStore";
import CopyFeedbackButton from "./CopyFeedbackButton";
import { FocusFrame } from "./WorkspaceShell";

type JsonViewMode = "edit" | "tree" | "graph";

export default function JsonDocumentEditor(props: {
  document: ProjectDocument;
  content: string;
  busy: boolean;
  onContentChange: (value: string) => void;
  onCopy: () => Promise<boolean>;
}) {
  const [mode, setMode] = React.useState<JsonViewMode>("edit");
  const parsed = React.useMemo(() => parseJsonDocument(props.content), [props.content]);
  const graph = React.useMemo(() => (parsed.ok ? extractGraphFromJson(parsed.value) : null), [parsed]);
  const viewModes = React.useMemo<JsonViewMode[]>(
    () => (graph?.hasExplicitSchema ? ["edit", "tree", "graph"] : ["edit", "tree"]),
    [graph?.hasExplicitSchema],
  );

  React.useEffect(() => {
    if (mode === "graph" && !graph?.hasExplicitSchema) {
      setMode("tree");
    }
  }, [graph?.hasExplicitSchema, mode]);

  function prettyFormat() {
    if (!parsed.ok) return;
    props.onContentChange(JSON.stringify(parsed.value, null, 2));
  }

  return (
    <FocusFrame
      title={props.document.name}
      description="JSON document"
      bodyClassName="focusFrameBodyFill"
      actions={
        <div className="row">
          <button
            type="button"
            className="secondary jsonFormatButton"
            disabled={!parsed.ok || props.busy}
            onClick={prettyFormat}
          >
            Format
          </button>
          <CopyFeedbackButton title="Copy JSON" ariaLabel="Copy JSON" onCopy={props.onCopy} />
        </div>
      }
    >
      <div className="jsonDocument">
        <div className="segmentedControl jsonModeTabs" role="tablist" aria-label="JSON views">
          {viewModes.map((viewMode) => (
            <button
              key={viewMode}
              type="button"
              role="tab"
              aria-selected={mode === viewMode}
              className={"segmentedPill" + (mode === viewMode ? " active" : "")}
              onClick={() => setMode(viewMode)}
            >
              {viewMode.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="jsonViewportShell">
          <div className="jsonStatusSlot">
            {!parsed.ok ? <div className="jsonValidationError">Invalid JSON: {parsed.error}</div> : null}
            {parsed.ok && graph?.warnings.length ? (
              <div className="jsonWarnings">
                {graph.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}
          </div>

          {mode === "edit" ? (
            <textarea
              className="documentEditor jsonEditor"
              value={props.content}
              onChange={(event) => props.onContentChange(event.target.value)}
              disabled={props.busy}
              spellCheck={false}
            />
          ) : !parsed.ok ? (
            <div className="emptyContextState">
              <div className="surfaceTitle">JSON cannot be rendered</div>
              <div className="surfaceCopy">Fix the validation error in Edit mode before using derived views.</div>
            </div>
          ) : mode === "tree" || !graph?.hasExplicitSchema ? (
            <JsonTreeView value={parsed.value} />
          ) : (
            <JsonGraphView graph={graph} />
          )}
        </div>
      </div>
    </FocusFrame>
  );
}

function JsonTreeView(props: { value: unknown }) {
  return (
    <div className="jsonTree" role="tree">
      <JsonTreeNode name="root" value={props.value} depth={0} />
    </div>
  );
}

function JsonTreeNode(props: { name: string; value: unknown; depth: number }) {
  const value = props.value;
  if (Array.isArray(value)) {
    return (
      <details className="jsonTreeNode" open={props.depth < 2}>
        <summary>
          <span className="jsonTreeKey">{props.name}</span>
          <span className="jsonTreeMeta">Array({value.length})</span>
        </summary>
        <div className="jsonTreeChildren">
          {value.map((item, index) => (
            <JsonTreeNode key={index} name={String(index)} value={item} depth={props.depth + 1} />
          ))}
        </div>
      </details>
    );
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <details className="jsonTreeNode" open={props.depth < 2}>
        <summary>
          <span className="jsonTreeKey">{props.name}</span>
          <span className="jsonTreeMeta">Object({entries.length})</span>
        </summary>
        <div className="jsonTreeChildren">
          {entries.map(([key, item]) => (
            <JsonTreeNode key={key} name={key} value={item} depth={props.depth + 1} />
          ))}
        </div>
      </details>
    );
  }

  return (
    <div className="jsonTreeLeaf">
      <span className="jsonTreeKey">{props.name}</span>
      <span className="jsonTreeValue">{formatPrimitive(value)}</span>
    </div>
  );
}

function JsonGraphView(props: { graph: JsonGraph }) {
  if (props.graph.nodes.length === 0) {
    return (
      <div className="emptyContextState">
        <div className="surfaceTitle">No relationship graph</div>
        <div className="surfaceCopy">This JSON has an explicit graph schema, but no graph nodes were found.</div>
      </div>
    );
  }

  const width = 900;
  const height = 540;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.34;
  const positions = new Map(
    props.graph.nodes.map((node, index) => {
      const angle = (index / props.graph.nodes.length) * Math.PI * 2 - Math.PI / 2;
      return [
        node.id,
        {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        },
      ];
    }),
  );

  return (
    <div className="jsonGraphViewport">
      <svg className="jsonGraphSvg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="JSON relationship graph">
        <defs>
          <marker id="jsonArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
        {props.graph.edges.map((edge) => {
          const source = positions.get(edge.source);
          const target = positions.get(edge.target);
          if (!source || !target) return null;
          const labelX = (source.x + target.x) / 2;
          const labelY = (source.y + target.y) / 2;
          return (
            <g key={edge.id} className={"jsonGraphEdge jsonGraphEdge-" + edge.type}>
              <line x1={source.x} y1={source.y} x2={target.x} y2={target.y} markerEnd="url(#jsonArrow)" />
              {edge.label ? (
                <text x={labelX} y={labelY}>
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}
        {props.graph.nodes.map((node) => {
          const position = positions.get(node.id);
          if (!position) return null;
          return (
            <g key={node.id} className="jsonGraphNode" transform={`translate(${position.x}, ${position.y})`}>
              <circle r="42" />
              <text className="jsonGraphNodeLabel" y="-4">
                {truncateLabel(node.label, 16)}
              </text>
              <text className="jsonGraphNodeType" y="15">
                {truncateLabel(node.explicitId || node.kind, 18)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function formatPrimitive(value: unknown) {
  if (typeof value === "string") return `"${value}"`;
  if (value === null) return "null";
  return String(value);
}

function truncateLabel(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
