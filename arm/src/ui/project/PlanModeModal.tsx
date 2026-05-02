import React from "react";
import { PlanMode, PlanQuestion, PlanStage } from "../../core/planning";
import { ProjectDocument } from "../../core/projectStore";
import Modal from "../shared/Modal";

type PlanModeModalProps = {
  busy: boolean;
  planStage: PlanStage;
  selectedDocIds: string[];
  sourceDocuments: ProjectDocument[];
  planContext: string;
  planMode: PlanMode;
  planQuestions: PlanQuestion[];
  planStatus: string | null;
  onClose: () => void;
  onBack: () => void;
  onStart: () => void;
  onContinue: () => void;
  onToggleSource: (documentId: string) => void;
  onContextChange: (value: string) => void;
  onModeChange: (mode: PlanMode) => void;
  onQuestionsChange: React.Dispatch<React.SetStateAction<PlanQuestion[]>>;
};

export default function PlanModeModal(props: PlanModeModalProps) {
  return (
    <Modal
      title="Plan Mode"
      onClose={props.onClose}
      footer={
        props.planStage === "setup" ? (
          <>
            <button type="button" className="secondary" onClick={props.onClose}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={props.onStart} disabled={props.busy}>
              Start Planning
            </button>
          </>
        ) : (
          <>
            <button type="button" className="secondary" onClick={props.onBack}>
              Back
            </button>
            <button type="button" className="primary" onClick={props.onContinue} disabled={props.busy}>
              Continue
            </button>
          </>
        )
      }
    >
      {props.planStage === "setup" ? <PlanSetup {...props} /> : <PlanInterrogation {...props} />}
    </Modal>
  );
}

function PlanSetup(props: PlanModeModalProps) {
  return (
    <div className="stack">
      <div className="settingsSection">
        <div className="settingsLabel">Source Selection</div>
        <div className="surfaceCopy">{props.selectedDocIds.length} documents selected</div>
        <div className="planSourceList">
          {props.sourceDocuments.map((document) => (
            <label key={document.id} className="planSourceItem">
              <input
                type="checkbox"
                checked={props.selectedDocIds.includes(document.id)}
                onChange={() => props.onToggleSource(document.id)}
              />
              <span className="documentType">{document.type}</span>
              <span className="documentName">{document.name}</span>
            </label>
          ))}
        </div>
        <div className="settingsMeta">
          Planning uses accepted cards when available. If no accepted cards exist, ARM uses the selected full documents.
        </div>
      </div>

      <div className="settingsSection">
        <div className="settingsLabel">Context Injection</div>
        <textarea
          className="miniEditor"
          value={props.planContext}
          placeholder={"Add constraints, goals, or context (optional)\n\nI have 3 days max\nThis is for a portfolio project\nBackend already exists"}
          onChange={(event) => props.onContextChange(event.target.value)}
        />
      </div>

      <div className="settingsSection">
        <div className="settingsLabel">Mode</div>
        <div className="segmentedControl planModeBar">
          {(["focused", "kill"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={"segmentedPill" + (props.planMode === mode ? " active" : "")}
              onClick={() => props.onModeChange(mode)}
            >
              {mode === "focused" ? "Focused Plan" : "Kill Plan"}
            </button>
          ))}
        </div>
      </div>
      {props.planStatus ? <div className="status">{props.planStatus}</div> : null}
    </div>
  );
}

function PlanInterrogation(props: PlanModeModalProps) {
  return (
    <div className="stack">
      <div className="surfaceTitle">We need clarification before planning</div>
      {props.planQuestions.map((question, index) => (
        <div key={question.id} className="planQuestion">
          <div className="reviewCardTitle">{index + 1}. {question.question}</div>
          <div className="surfaceCopy">Why it matters: {question.why}</div>
          <div className="surfaceCopy">Impact: {question.impact}</div>
          <div className="feedMeta">Source: {question.source}</div>
          <textarea
            className="miniEditor planAnswerInput"
            value={question.answer}
            disabled={question.skipped}
            placeholder="Answer inline..."
            onChange={(event) =>
              props.onQuestionsChange((current) =>
                current.map((item) => (item.id === question.id ? { ...item, answer: event.target.value } : item)),
              )
            }
          />
          <label className="sidebarCheckbox">
            <input
              type="checkbox"
              checked={question.skipped}
              onChange={(event) =>
                props.onQuestionsChange((current) =>
                  current.map((item) =>
                    item.id === question.id
                      ? { ...item, skipped: event.target.checked, answer: event.target.checked ? "" : item.answer }
                      : item,
                  ),
                )
              }
            />
            <span>Skip (assume default)</span>
          </label>
        </div>
      ))}
      {props.planStatus ? <div className="status">{props.planStatus}</div> : null}
    </div>
  );
}
