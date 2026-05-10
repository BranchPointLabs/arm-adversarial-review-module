import React from "react";
import { AgentCard } from "../../core/projectStore";
import { cardFilterLabel, CardFilter, countCards, SidebarItemView } from "./cardSidebar";

type ChatMode = "chat" | "product" | "technical" | "security";
type SidebarItem = React.ComponentProps<typeof SidebarItemView>["item"];

export default function ReviewRail(props: {
  open: boolean;
  cards: AgentCard[];
  sidebarItems: SidebarItem[];
  cardFilter: CardFilter;
  showAllCards: boolean;
  showDismissedCards: boolean;
  chatMode: ChatMode;
  allReviewMode: boolean;
  prompt: string;
  busy: boolean;
  submitBusy: boolean;
  onResizeStart: React.PointerEventHandler<HTMLDivElement>;
  onOpen: () => void;
  onCardFilterChange: (filter: CardFilter) => void;
  onShowAllCardsChange: (value: boolean) => void;
  onShowDismissedCardsChange: (value: boolean) => void;
  onClearVisibleCards: () => void;
  onPromptChange: (value: string) => void;
  onSubmitPrompt: () => void;
  onChatModeChange: (mode: ChatMode) => void;
  onAllReviewModeChange: (value: boolean) => void;
  onAcceptCard: (card: AgentCard) => void;
  onDismissCard: (card: AgentCard) => void;
}) {
  return (
    <aside className="inputPane reviewRail unifiedSidebar" aria-label="Unified activity sidebar">
      <div
        className="rightRailResizeHandle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize activity sidebar"
        onPointerDown={props.onResizeStart}
      />
      {!props.open ? (
        <button
          type="button"
          className="iconButton rightRailOpenButton"
          title="Open activity sidebar"
          aria-label="Open activity sidebar"
          onClick={props.onOpen}
        >
          {"<"}
        </button>
      ) : (
        <>
          <div className="segmentedControl sidebarFeatureBar">
            {(["info", "open_question", "warning", "action"] as CardFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                className={`segmentedPill cardTypePill cardTypePill-${filter}` + (props.cardFilter === filter ? " active" : "")}
                onClick={() => props.onCardFilterChange(filter)}
              >
                {cardFilterLabel(filter)} ({countCards(props.cards, filter, props.showDismissedCards)})
              </button>
            ))}
          </div>
          <div className="sidebarVisibilityControls">
            <label className="sidebarCheckbox">
              <input
                type="checkbox"
                checked={props.showAllCards}
                onChange={(event) => props.onShowAllCardsChange(event.target.checked)}
              />
              <span>Show all</span>
            </label>
            <label className="sidebarCheckbox">
              <input
                type="checkbox"
                checked={props.showDismissedCards}
                onChange={(event) => props.onShowDismissedCardsChange(event.target.checked)}
              />
              <span>Show dismissed</span>
            </label>
            <button
              type="button"
              className="linkButton sidebarClearButton"
              disabled={props.busy || props.sidebarItems.every((item) => item.card.status === "rejected")}
              onClick={props.onClearVisibleCards}
            >
              Clear all
            </button>
          </div>
          <div className="inputCardList unifiedStream">
            {props.sidebarItems.map((item) => (
              <SidebarItemView
                key={item.id}
                item={item}
                onAccept={props.onAcceptCard}
                onDismiss={props.onDismissCard}
              />
            ))}
            {props.sidebarItems.length === 0 ? <div className="muted">No activity here yet.</div> : null}
          </div>
          <div className="sidebarComposer">
            <textarea
              className="sidebarComposerInput"
              value={props.prompt}
              placeholder={composerPlaceholder(props.chatMode)}
              onChange={(event) => props.onPromptChange(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !props.submitBusy) props.onSubmitPrompt();
              }}
            />
            <div className="segmentedControl sidebarActionBar">
              {(["chat", "product", "technical", "security"] as ChatMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={
                    "segmentedPill" +
                    (props.allReviewMode ? (mode === "chat" ? "" : " active") : props.chatMode === mode ? " active" : "")
                  }
                  onClick={() => props.onChatModeChange(mode)}
                >
                  {chatModeLabel(mode)}
                </button>
              ))}
            </div>
            <div className="sidebarComposerFooter">
              <button
                type="button"
                className="primary submitButton"
                onClick={props.onSubmitPrompt}
                disabled={props.busy || props.submitBusy || !props.prompt.trim()}
              >
                {props.submitBusy ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    <span>Submitting</span>
                  </>
                ) : (
                  "Submit"
                )}
              </button>
              <label className="sidebarCheckbox allReviewCheckbox">
                <input
                  type="checkbox"
                  checked={props.allReviewMode}
                  onChange={(event) => props.onAllReviewModeChange(event.target.checked)}
                />
                <span>All</span>
              </label>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

function chatModeLabel(mode: ChatMode) {
  if (mode === "chat") return "Chat";
  if (mode === "product") return "Product";
  if (mode === "technical") return "Technical";
  return "Security";
}

function composerPlaceholder(mode: ChatMode) {
  if (mode === "chat") return "Ask ARM anything about this document...";
  if (mode === "product") return "Ask the product persona to evaluate this...";
  if (mode === "technical") return "Ask the technical persona to evaluate this...";
  return "Ask the security persona to evaluate this...";
}
