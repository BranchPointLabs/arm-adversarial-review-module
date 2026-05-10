import { DocumentType } from "../../core/projectStore";
import Modal from "../shared/Modal";

export default function AddDocumentModal(props: {
  busy: boolean;
  name: string;
  kind: "text" | "diagram";
  type: DocumentType;
  status: string | null;
  onClose: () => void;
  onCreate: () => void;
  onNameChange: (value: string) => void;
  onKindChange: (kind: "text" | "diagram") => void;
  onTypeChange: (type: DocumentType) => void;
}) {
  return (
    <Modal
      title="Add Document"
      onClose={props.onClose}
      footer={
        <>
          <button type="button" className="secondary" onClick={props.onClose}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={props.onCreate} disabled={props.busy}>
            Add
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="segmentedControl documentKindBar">
          {(["text", "diagram"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className={"segmentedPill" + (props.kind === kind ? " active" : "")}
              onClick={() => props.onKindChange(kind)}
            >
              {kind === "text" ? "Text" : "Diagram"}
            </button>
          ))}
        </div>
        <input
          autoFocus
          className="textInput"
          value={props.name}
          placeholder="Document name"
          onChange={(event) => props.onNameChange(event.target.value)}
        />
        {props.kind === "text" ? (
          <select
            className="selectInput"
            value={props.type}
            onChange={(event) => props.onTypeChange(event.target.value as DocumentType)}
          >
            <option value="IDEA">IDEA</option>
            <option value="PRD">PRD</option>
            <option value="PLAN">PLAN</option>
          </select>
        ) : null}
        {props.status ? <div className="status">{props.status}</div> : null}
      </div>
    </Modal>
  );
}
