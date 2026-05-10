import { AgentCard, ReviewSession } from "../../core/projectStore";
import { reviewSessionTurns } from "../../core/reviewSession";
import Modal from "../shared/Modal";

export default function ReviewSessionModal(props: {
  reviewGenerating: boolean;
  reviewSession: ReviewSession | null;
  reviewSessionCards: AgentCard[];
  playbackState: "idle" | "playing" | "paused";
  onClose: () => void;
  onPlayPause: () => void;
  onRestart: () => void;
}) {
  return (
    <Modal
      title="Scrum Review Audio"
      onClose={props.onClose}
      footer={
        <>
          <button
            type="button"
            className="secondary"
            disabled={props.reviewGenerating || !props.reviewSession}
            onClick={props.onPlayPause}
          >
            {props.playbackState === "playing" ? "Pause" : props.playbackState === "paused" ? "Resume" : "Play"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={props.reviewGenerating || !props.reviewSession}
            onClick={props.onRestart}
          >
            Restart
          </button>
          <button type="button" className="primary" onClick={props.onClose}>
            Close
          </button>
        </>
      }
    >
      {props.reviewGenerating ? (
        <div className="reviewSessionGenerating" role="status" aria-live="polite">
          <span className="spinner generationSpinner" aria-hidden="true" />
          <div className="surfaceTitle">Generating scrum review</div>
          <div className="surfaceCopy">Running Product, Technical, and Security passes before creating the audio script.</div>
        </div>
      ) : (
        <div className="reviewSessionPanel">
          <div className="reviewSessionTranscript">
            {reviewSessionTurns(props.reviewSession).map((turn, index) => (
              <div key={`${turn.speaker}-${index}`} className="feedItem reviewTurn">
                <div className="reviewTurnHeader">
                  <span className="reviewCardTitle">{turn.speaker}</span>
                  <span className="feedMeta">{turn.segment}</span>
                </div>
                <div className="surfaceCopy">{turn.text}</div>
              </div>
            ))}
          </div>
          <div className="surfaceTitle">Extracted cards</div>
          <div className="reviewSessionCards">
            {props.reviewSessionCards.map((card) => (
              <div key={card.id} className="reviewCard">
                <div className="reviewCardHeader">
                  <span className={"reviewCardType cardTypeBadge cardTypeBadge-" + card.type}>{formatCardType(card.type)}</span>
                  <span className="reviewCardStatus">{card.sourceAgent}</span>
                </div>
                <div className="reviewCardTitle">{card.title}</div>
                <div className="reviewCardBody">{card.body}</div>
              </div>
            ))}
            {props.reviewSessionCards.length === 0 ? <div className="muted">No cards were created for this session.</div> : null}
          </div>
        </div>
      )}
    </Modal>
  );
}

function formatCardType(value: string) {
  if (value === "open_question") return "Question";
  return value.replace("_", " ");
}
