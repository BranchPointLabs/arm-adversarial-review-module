const { buildFindings, renderDecision, renderReview } = require("../review");

async function review({ type, artifact, maxFindings }) {
  const label = type === "roast" ? "ARM ROAST" : "ARM REVIEW";
  const findings = buildFindings(type, artifact.text).slice(0, maxFindings);
  return renderReview(label, findings, type);
}

async function decide({ artifact }) {
  const findings = buildFindings("executive", artifact.text).slice(0, 3);
  return renderDecision(findings);
}

module.exports = {
  review,
  decide,
};
