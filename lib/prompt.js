const fs = require("fs");
const path = require("path");

function assembleReviewPrompt(root, config, type, artifact) {
  const command = config.commands[`review_${type}`];
  const personas = command.personas || [];
  const wordBudget = config.output.max_words[type];
  const checklist = getChecklist(root, config, type);

  return [
    read(root, config.prompts.system),
    "",
    read(root, config.prompts.review),
    "",
    "## Runtime Context",
    "",
    fenced([
      `artifact_type: ${type}`,
      `artifact_path: ${artifact.path}`,
      `personas: ${personas.join(", ")}`,
      `word_budget: ${wordBudget}`,
      `schema: ${config.schemas.review}`,
      `style: slate.md`,
    ].join("\n")),
    "",
    "## Persona Mandates",
    "",
    personas.map((persona) => readOptional(root, `personas/${persona}.md`)).filter(Boolean).join("\n\n"),
    "",
    "## Checklist",
    "",
    checklist,
    "",
    "## Artifact",
    "",
    fenced(artifact.text),
  ].join("\n");
}

function assembleDecisionPrompt(root, config, artifact) {
  const personas = config.commands.decide.personas || [];
  const wordBudget = config.output.max_words.decide;
  const checklist = getChecklist(root, config, "executive");

  return [
    read(root, config.prompts.system),
    "",
    read(root, config.prompts.decide),
    "",
    "## Runtime Context",
    "",
    fenced([
      `artifact_path: ${artifact.path}`,
      `personas: ${personas.join(", ")}`,
      `word_budget: ${wordBudget}`,
      `schema: ${config.schemas.decision}`,
      `style: slate.md`,
    ].join("\n")),
    "",
    "## Persona Mandates",
    "",
    personas.map((persona) => readOptional(root, `personas/${persona}.md`)).filter(Boolean).join("\n\n"),
    "",
    "## Checklist",
    "",
    checklist,
    "",
    "## Artifact",
    "",
    fenced(artifact.text),
  ].join("\n");
}

function read(root, file) {
  return fs.readFileSync(path.join(root, file), "utf8").trim();
}

function readOptional(root, file) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    return "";
  }

  return fs.readFileSync(fullPath, "utf8").trim();
}

function getChecklist(root, config, type) {
  if (type === "roast") {
    return ["idea", "prd", "rfc", "executive"]
      .map((name) => readOptional(root, config.checklists[name]))
      .filter(Boolean)
      .join("\n\n");
  }

  return readOptional(root, config.checklists[type]);
}

function fenced(value) {
  return ["```text", value.trim(), "```"].join("\n");
}

module.exports = {
  assembleReviewPrompt,
  assembleDecisionPrompt,
};
