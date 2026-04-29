function buildFindings(type, text) {
  const lower = text.toLowerCase();
  const findings = [];

  if (!hasAny(lower, ["user", "customer", "persona", "segment"])) {
    findings.push(finding("HIGH", "PM", "Target user missing.", "Adoption risk cannot be judged.", "Define primary user segment."));
  }

  if (!hasAny(lower, ["evidence", "interview", "research", "data", "validated", "usage"])) {
    findings.push(finding("HIGH", "CPO", "Problem evidence weak.", "Resource commitment is not justified.", "Validate frequency and severity."));
  }

  if (!hasAny(lower, ["metric", "success", "kpi", "measure"])) {
    findings.push(finding("MEDIUM", "PM", "Success measure missing.", "Impact cannot be judged.", "Define one decision-grade metric."));
  }

  if (["rfc", "executive", "roast"].includes(type) && !hasAny(lower, ["buy", "vendor", "no-code", "nocode", "alternative"])) {
    findings.push(finding("HIGH", "CTO", "Alternatives missing.", "Custom build may be wasteful.", "Compare build, buy, and no-code paths."));
  }

  if (["rfc", "roast"].includes(type) && !hasAny(lower, ["rollback", "migration", "operate", "monitor", "maintenance"])) {
    findings.push(finding("MEDIUM", "Architect", "Operational plan thin.", "Maintenance burden is unknown.", "Add rollout, rollback, and ownership."));
  }

  if (["rfc", "roast"].includes(type) && !hasAny(lower, ["security", "privacy", "auth", "permission", "pii"])) {
    findings.push(finding("MEDIUM", "Security", "Security review absent.", "Data and abuse risk may be hidden.", "Add threat and privacy review."));
  }

  if (findings.length === 0) {
    findings.push(finding("LOW", "Critic", "No obvious blocker found in heuristic pass.", "Model review is still required.", "Run full ARM review with LLM backend."));
  }

  return findings;
}

function renderReview(label, findings, type) {
  const verdict = getVerdict(findings);

  return [
    "===============",
    label,
    "",
    `Verdict: ${verdict}`,
    "Confidence: Low",
    "",
    "Top Findings:",
    ...findings.map((item, index) => `${index + 1}. [${item.severity}] ${item.persona}: ${item.issue} ${item.consequence} ${item.action}`),
    "",
    "Risks:",
    ...findings.slice(0, 2).map((item, index) => `${index + 1}. ${item.consequence} Mitigation: ${item.action}`),
    "",
    "Assumptions:",
    `1. Artifact has enough context for ${type} review. Validate with owner.`,
    "",
    "Open Questions:",
    "1. What decision should this artifact support?",
    "",
    "Next Step:",
    "1. Resolve top finding before approval.",
    "===============",
  ].join("\n");
}

function renderDecision(findings) {
  return [
    "===============",
    "ARM DECISION",
    "",
    `Verdict: ${getVerdict(findings)}`,
    "Confidence: Low",
    "",
    "Why:",
    ...findings.map((finding, index) => `${index + 1}. ${finding.issue} ${finding.consequence}`),
    "",
    "Next Gate:",
    "1. Resolve highest-severity finding before approval.",
    "===============",
  ].join("\n");
}

function getVerdict(findings) {
  return findings.some((finding) => finding.severity === "HIGH")
    ? "Needs Validation"
    : "Approved with Conditions";
}

function finding(severity, persona, issue, consequence, action) {
  return { severity, persona, issue, consequence, action };
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

module.exports = {
  buildFindings,
  renderReview,
  renderDecision,
};
