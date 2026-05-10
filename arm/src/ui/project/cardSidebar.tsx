import React from "react";
import { AgentCard } from "../../core/projectStore";

export type CardFilter = "info" | "open_question" | "warning" | "action";

type SidebarItem = { kind: "card"; id: string; createdAt: string; card: AgentCard };

export function buildSidebarItems(
  cards: AgentCard[],
  cardFilter: CardFilter,
  showAllCards: boolean,
  showDismissedCards: boolean,
): SidebarItem[] {
  return cards
    .filter((card) => (showAllCards || card.type === cardFilter) && (showDismissedCards || card.status !== "rejected"))
    .map((card) => ({ kind: "card" as const, id: card.id, createdAt: card.createdAt, card }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function countCards(cards: AgentCard[], cardFilter: CardFilter, showDismissedCards: boolean) {
  return cards.filter((card) => card.type === cardFilter && (showDismissedCards || card.status !== "rejected")).length;
}

export function SidebarItemView(props: {
  item: SidebarItem;
  onAccept: (card: AgentCard) => void;
  onDismiss: (card: AgentCard) => void;
}) {
  const card = props.item.card;

  return (
    <div className={"reviewCard reviewCard-" + card.status}>
      <div className="reviewCardHeader">
        <div className="reviewCardPills">
          <span className={"reviewCardType cardTypeBadge cardTypeBadge-" + card.type}>{formatCardType(card.type)}</span>
          <span className={"reviewCardType sourceBadge sourceBadge-" + sourceKind(card.sourceAgent)}>
            {formatSourceKind(card.sourceAgent)}
          </span>
        </div>
        <span className="reviewCardStatus">{card.status}</span>
      </div>
      <div className="reviewCardTitle">{card.title}</div>
      <div className="reviewCardBody">{card.body}</div>
      {card.sourceDocumentTitle ? (
        <div className="reviewCardSource">
          Source: {card.sourceDocumentTitle}{card.sourceSectionTitle ? ` > ${card.sourceSectionTitle}` : ""}
        </div>
      ) : null}
      {card.proposedUpdate ? <div className="reviewCardUpdate">{card.proposedUpdate}</div> : null}
      <div className="reviewCardActions">
        <button type="button" className="secondary" onClick={() => props.onAccept(card)}>
          Accept
        </button>
        <button type="button" className="secondary" onClick={() => props.onDismiss(card)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function cardFilterLabel(filter: CardFilter) {
  if (filter === "info") return "Info";
  if (filter === "open_question") return "Question";
  if (filter === "warning") return "Warning";
  return "Next Steps";
}

function formatCardType(value: string) {
  if (value === "info") return "info";
  if (value === "open_question") return "open question";
  if (value === "action") return "next step";
  if (value === "warning") return "warning";
  return value.replace(/_/g, " ");
}

function sourceKind(sourceAgent: string) {
  const source = sourceAgent.toLowerCase();
  if (source.includes("security")) return "security";
  if (source.includes("engineer") || source.includes("technical")) return "technical";
  if (source.includes("product") || source.includes("pm") || source.includes("cpo") || source.includes("scope")) return "product";
  return "info";
}

function formatSourceKind(sourceAgent: string) {
  const kind = sourceKind(sourceAgent);
  if (kind === "technical") return "Technical";
  if (kind === "security") return "Security";
  if (kind === "product") return "Product";
  return "Info";
}
