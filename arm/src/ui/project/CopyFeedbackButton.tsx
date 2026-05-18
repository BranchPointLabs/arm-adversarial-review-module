import React from "react";
import { CheckIcon, CopyIcon } from "./ProjectIcons";

export default function CopyFeedbackButton(props: {
  title: string;
  ariaLabel: string;
  disabled?: boolean;
  onCopy: () => Promise<boolean>;
}) {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function copyNow() {
    const ok = await props.onCopy();
    if (!ok) return;
    setCopied(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, 1200);
  }

  return (
    <button
      type="button"
      className={"iconButton" + (copied ? " active" : "")}
      title={copied ? "Copied" : props.title}
      aria-label={copied ? "Copied" : props.ariaLabel}
      disabled={props.disabled}
      onClick={() => void copyNow()}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}
