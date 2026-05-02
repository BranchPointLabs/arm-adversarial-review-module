export function defaultContext(name: string) {
  return [
    "# Current Context",
    "",
    "## What this project is",
    `- ${name}`,
    "",
    "## What this project is not",
    "- ",
    "",
    "## Current direction",
    "- ",
    "",
    "## Important decisions",
    "- ",
    "",
    "## Constraints",
    "- ",
    "",
    "## Open questions",
    "- ",
    "",
    "## Risks",
    "- ",
    "",
    "## Next actions",
    "- ",
    "",
  ].join("\n");
}

export function defaultDocumentMarkdown(name: string, type: "IDEA" | "PRD" | "PLAN") {
  if (type === "PLAN") {
    return [
      `# ${name}`,
      "",
      "## Initiative 1",
      "- Source: ",
      "- Why: ",
      "- Action: ",
      "- Success Signal: ",
      "",
      "## Decision after execution",
      "- [ ] Proceed",
      "- [ ] Iterate",
      "- [ ] Kill",
      "",
    ].join("\n");
  }

  if (type === "PRD") {
    return [
      `# ${name}`,
      "",
      "## Problem",
      "- ",
      "",
      "## Users",
      "- ",
      "",
      "## Scope",
      "- ",
      "",
      "## Requirements",
      "- ",
      "",
      "## Risks",
      "- ",
      "",
      "## Open Questions",
      "- ",
      "",
    ].join("\n");
  }

  return [
    `# ${name}`,
    "",
    "## Idea",
    "- ",
    "",
    "## Why it matters",
    "- ",
    "",
    "## Current assumptions",
    "- ",
    "",
    "## Risks",
    "- ",
    "",
    "## Next actions",
    "- ",
    "",
  ].join("\n");
}
