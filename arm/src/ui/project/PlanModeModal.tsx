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
  const [activeQuestionIndex, setActiveQuestionIndex] = React.useState(0);
  const questionCount = props.planQuestions.length;
  const isLastQuestion = activeQuestionIndex >= Math.max(0, questionCount - 1);

  React.useEffect(() => {
    setActiveQuestionIndex(0);
  }, [props.planStage, questionCount]);

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
            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (activeQuestionIndex > 0) {
                  setActiveQuestionIndex((index) => index - 1);
                } else {
                  props.onBack();
                }
              }}
            >
              {activeQuestionIndex > 0 ? "Previous" : "Back"}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (!isLastQuestion) {
                  setActiveQuestionIndex((index) => Math.min(index + 1, questionCount - 1));
                } else {
                  props.onContinue();
                }
              }}
              disabled={props.busy || questionCount === 0}
            >
              {isLastQuestion ? "Continue" : "Next"}
            </button>
          </>
        )
      }
    >
      {props.planStage === "setup" ? (
        <PlanSetup {...props} />
      ) : (
        <PlanInterrogation {...props} activeQuestionIndex={activeQuestionIndex} />
      )}
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

function PlanInterrogation(props: PlanModeModalProps & { activeQuestionIndex: number }) {
  const question = props.planQuestions[props.activeQuestionIndex];
  const questionCount = props.planQuestions.length;
  const progressPercent = questionCount > 0 ? ((props.activeQuestionIndex + 1) / questionCount) * 100 : 0;

  return (
    <div className="stack">
      <div className="planProgress">
        <div className="planProgressMeta">
          <span>Question {questionCount > 0 ? props.activeQuestionIndex + 1 : 0} of {questionCount}</span>
        </div>
        <div className="planProgressTrack" aria-hidden="true">
          <div className="planProgressFill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
      <div className="surfaceTitle">We need clarification before planning</div>
      {question ? (
        <div key={question.id} className="planQuestion">
          <div className="reviewCardTitle">{props.activeQuestionIndex + 1}. {question.question}</div>
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
      ) : (
        <div className="muted">No clarification questions generated.</div>
      )}
      {props.planStatus ? <div className="status">{props.planStatus}</div> : null}
    </div>
  );
}
