import React from "react";

export function NavButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={"workspaceNavItem" + (props.active ? " active" : "")} onClick={props.onClick}>
      {props.label}
    </button>
  );
}

export function FocusFrame(props: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="focusFrame">
      <div className="focusFrameHeader">
        <div>
          <div className="focusTitle">{props.title}</div>
          <div className="focusDescription">{props.description}</div>
        </div>
        {props.actions ? <div className="focusActions">{props.actions}</div> : null}
      </div>
      <div className={"focusFrameBody" + (props.bodyClassName ? ` ${props.bodyClassName}` : "")}>{props.children}</div>
    </div>
  );
}
