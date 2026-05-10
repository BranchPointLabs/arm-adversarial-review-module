import type React from "react";
import { PlanningModalCard, PlanStage, planningQuestionCardsComplete, resolvedQuestionAnswer } from "../../core/planning";
import { ProjectDocument } from "../../core/projectStore";
import Modal from "../shared/Modal";

type PlanningModalProps = {
  busy: boolean;
  planStage: PlanStage;
  selectedDocIds: string[];
  sourceDocuments: ProjectDocument[];
  planContext: string;
  planningCards: PlanningModalCard[];
  planOutline: string;
  planStatus: string | null;
  onClose: () => void;
  onBack: () => void;
  onStart: () => void;
  onDiscoveryContinue: () => void;
  onClarificationContinue: () => void;
  onFinalGenerate: () => void;
  onToggleSource: (documentId: string) => void;
  onContextChange: (value: string) => void;
  onCardAcceptedChange: (cardId: string, accepted: boolean) => void;
  onQuestionSuggestedAnswer: (cardId: string, answer: string) => void;
  onQuestionCustomAnswer: (cardId: string, answer: string) => void;
  onQuestionSkippedChange: (cardId: string, skipped: boolean) => void;
  onOutlineChange: (value: string) => void;
};

export default function PlanningModal(props: PlanningModalProps) {
  const questionCards = props.planningCards.filter((card) => card.type === "question");
  const questionsComplete = planningQuestionCardsComplete(props.planningCards);

  return (
    <Modal title="Planning" onClose={props.onClose} footer={modalFooter(props, questionCards.length, questionsComplete)}>
      <PlanStageProgress stage={props.planStage} />
      {props.planStage === "setup" ? <PlanSetup {...props} /> : null}
      {props.planStage === "discovery" ? <PlanDiscovery {...props} /> : null}
      {props.planStage === "clarification" ? <PlanClarification {...props} questionCards={questionCards} /> : null}
      {props.planStage === "outline_review" ? <PlanOutlineReview {...props} /> : null}
      {props.planStage === "final_generation" ? <PlanFinalGeneration /> : null}
    </Modal>
  );
}

function modalFooter(props: PlanningModalProps, questionCount: number, questionsComplete: boolean) {
  if (props.planStage === "setup") {
    return (
      <>
        <button type="button" className="secondary" onClick={props.onClose}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={props.onStart} disabled={props.busy}>
          Start Planning
        </button>
      </>
    );
  }

  if (props.planStage === "discovery") {
    return (
      <>
        <button type="button" className="secondary" onClick={props.onBack} disabled={props.busy}>
          Back
        </button>
        <button type="button" className="primary" onClick={props.onDiscoveryContinue} disabled={props.busy}>
          Continue
        </button>
      </>
    );
  }

  if (props.planStage === "clarification") {
    return (
      <>
        <button type="button" className="secondary" onClick={props.onBack} disabled={props.busy}>
          Back
        </button>
        <button
          type="button"
          className="primary"
          onClick={props.onClarificationContinue}
          disabled={props.busy || questionCount === 0 || !questionsComplete}
        >
          Continue
        </button>
      </>
    );
  }

  if (props.planStage === "outline_review") {
    return (
      <>
        <button type="button" className="secondary" onClick={props.onBack} disabled={props.busy}>
          Back
        </button>
        <button type="button" className="primary" onClick={props.onFinalGenerate} disabled={props.busy}>
          Accept and Generate
        </button>
      </>
    );
  }

  return (
    <button type="button" className="secondary" disabled>
      Generating
    </button>
  );
}

function PlanStageProgress(props: { stage: PlanStage }) {
  const stages: { stage: PlanStage; label: string }[] = [
    { stage: "setup", label: "Setup" },
    { stage: "discovery", label: "Discovery" },
    { stage: "clarification", label: "Clarification" },
    { stage: "outline_review", label: "Outline" },
    { stage: "final_generation", label: "Generate" },
  ];
  const activeIndex = stages.findIndex((item) => item.stage === props.stage);

  return (
    <div className="planStageRail" aria-label="Planning progress">
      {stages.map((item, index) => (
        <div key={item.stage} className={"planStageStep" + (index <= activeIndex ? " active" : "")}>
          {item.label}
        </div>
      ))}
    </div>
  );
}

function PlanSetup(props: PlanningModalProps) {
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
      {props.planStatus ? <div className="status">{props.planStatus}</div> : null}
    </div>
  );
}

function PlanDiscovery(props: PlanningModalProps) {
  const nonQuestionCards = props.planningCards.filter((card) => card.type !== "question");
  const questionCards = props.planningCards.filter((card) => card.type === "question");

  return (
    <div className="stack">
      <div>
        <div className="surfaceTitle">Discovery cards</div>
        <div className="surfaceCopy">
          These cards are local to this planning run and will not appear in the review feed.
        </div>
      </div>
      <div className="planningCardList">
        {nonQuestionCards.map((card) => (
          <PlanningCard key={card.id} card={card}>
            <label className="sidebarCheckbox">
              <input
                type="checkbox"
                checked={card.accepted}
                onChange={(event) => props.onCardAcceptedChange(card.id, event.target.checked)}
              />
              <span>Use in outline</span>
            </label>
          </PlanningCard>
        ))}
      </div>
      <div className="settingsMeta">{questionCards.length} question cards ready for clarification.</div>
      {props.planStatus ? <div className="status">{props.planStatus}</div> : null}
    </div>
  );
}

function PlanClarification(props: PlanningModalProps & { questionCards: PlanningModalCard[] }) {
  return (
    <div className="stack">
      <div>
        <div className="surfaceTitle">Clarification questions</div>
        <div className="surfaceCopy">Choose a suggestion, write a custom answer, or skip so ARM can make the safest explicit assumption.</div>
      </div>
      <div className="planningCardList">
        {props.questionCards.map((card) => (
          <PlanningCard key={card.id} card={card}>
            {card.suggestedAnswers && card.suggestedAnswers.length > 0 ? (
              <div className="suggestedAnswerList" aria-label={`${card.title} suggested answers`}>
                {card.suggestedAnswers.map((answer) => (
                  <button
                    key={answer}
                    type="button"
                    className={"suggestedAnswer" + (card.selectedSuggestedAnswer === answer ? " active" : "")}
                    disabled={card.skipped}
                    onClick={() => props.onQuestionSuggestedAnswer(card.id, answer)}
                  >
                    {answer}
                  </button>
                ))}
              </div>
            ) : null}
            <textarea
              className="miniEditor planAnswerInput"
              value={card.customAnswer}
              disabled={card.skipped}
              placeholder={card.selectedSuggestedAnswer || "Write a custom answer..."}
              onChange={(event) => props.onQuestionCustomAnswer(card.id, event.target.value)}
            />
            <label className="sidebarCheckbox">
              <input
                type="checkbox"
                checked={card.skipped}
                onChange={(event) => props.onQuestionSkippedChange(card.id, event.target.checked)}
              />
              <span>Skip (assume default)</span>
            </label>
            {!card.skipped && resolvedQuestionAnswer(card) ? (
              <div className="settingsMeta">Answer: {resolvedQuestionAnswer(card)}</div>
            ) : null}
          </PlanningCard>
        ))}
      </div>
      {props.planStatus ? <div className="status">{props.planStatus}</div> : null}
    </div>
  );
}

function PlanOutlineReview(props: PlanningModalProps) {
  return (
    <div className="stack">
      <div>
        <div className="surfaceTitle">Outline review</div>
        <div className="surfaceCopy">Edit this outline before final generation. It will be included as planning context, not saved as a partial plan.</div>
      </div>
      <textarea
        className="documentEditor planOutlineEditor"
        value={props.planOutline}
        onChange={(event) => props.onOutlineChange(event.target.value)}
        spellCheck={false}
      />
      {props.planStatus ? <div className="status">{props.planStatus}</div> : null}
    </div>
  );
}

function PlanFinalGeneration() {
  return (
    <div className="stack">
      <div className="planGeneratingInline">
        <span className="spinner generationSpinner" aria-hidden="true" />
        <div>
          <div className="surfaceTitle">Generating final plan</div>
          <div className="surfaceCopy">Using the existing PLAN renderer and output contract.</div>
        </div>
      </div>
    </div>
  );
}

function PlanningCard(props: { card: PlanningModalCard; children?: React.ReactNode }) {
  return (
    <div className="planQuestion planningModalCard">
      <div className="reviewCardHeader">
        <div className="reviewCardType">{props.card.type.replace("_", " ")}</div>
        <div className="reviewCardStatus">{props.card.source}</div>
      </div>
      <div className="reviewCardTitle">{props.card.title}</div>
      <div className="reviewCardBody">{props.card.question || props.card.body}</div>
      {props.card.question && props.card.body ? <div className="reviewCardSource">{props.card.body}</div> : null}
      {props.children}
    </div>
  );
}
