const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { loadConfig, getOutputDir, getReviewCommand } = require("../lib/config");
const { assembleReviewPrompt, assembleDecisionPrompt } = require("../lib/prompt");
const { buildFindings, renderReview, renderDecision } = require("../lib/review");
const { listMarkdownFiles, readMarkdownFile } = require("../lib/catalog");
const { parseOptions } = require("../lib/options");
const { getBackend } = require("../lib/backends");
const { enforceSlateOutput, repairSlateOutput, wordCount } = require("../lib/validate");
const { runDecision, runReview } = require("../lib/engine");

const root = path.resolve(__dirname, "..");

const config = loadConfig(root);
const artifact = {
  path: path.join(root, "examples", "idea.md"),
  text: fs.readFileSync(path.join(root, "examples", "idea.md"), "utf8"),
};

assert.strictEqual(config.style, "slate");
assert.strictEqual(config.backend.default, "heuristic");
assert.strictEqual(config.backend.model, null);
assert.deepStrictEqual(config.verdicts, [
  "Approved",
  "Approved with Conditions",
  "Needs Revision",
  "Needs Validation",
  "Do Not Proceed",
]);
assert.deepStrictEqual(getReviewCommand(config, "idea").personas, ["critic", "cpo", "customer", "pm"]);
assert.strictEqual(path.relative(root, getOutputDir(root, config)), path.join("docs", "arm"));

const prompt = assembleReviewPrompt(root, config, "idea", artifact);
assert(prompt.includes("artifact_type: idea"));
assert(prompt.includes("personas: critic, cpo, customer, pm"));
assert(prompt.includes("word_budget: 500"));
assert(prompt.includes("# CPO"));
assert(prompt.includes("# Idea Checklist"));

const decisionPrompt = assembleDecisionPrompt(root, config, artifact);
assert(decisionPrompt.includes("schema: schemas/decision-output.md"));
assert(decisionPrompt.includes("word_budget: 300"));
assert(decisionPrompt.includes("# Executive Checklist"));

const findings = buildFindings("roast", artifact.text);
assert(findings.some((finding) => finding.persona === "CTO"));
assert(renderReview("ARM ROAST", findings, "roast").includes("ARM ROAST"));
assert(renderDecision(findings.slice(0, 3)).includes("ARM DECISION"));
assert(listMarkdownFiles(root, "personas").includes("cpo"));
assert(readMarkdownFile(root, "personas", "cto").includes("Is code the right answer?"));
assert(Object.keys(config.checklists).includes("prd"));
assert.strictEqual(parseOptions(["review", "idea", "x.md", "--no-write"]).options.noWrite, true);
assert.strictEqual(parseOptions(["review", "idea", "--stdin"]).options.stdin, true);
assert.strictEqual(typeof getBackend("heuristic").review, "function");
const repaired = repairSlateOutput("Too long\nand loose", "ARM REVIEW", 50);
assert.strictEqual(enforceSlateOutput(repaired, 50).length, 0);
assert(wordCount(repaired) <= 50);

Promise.all([
  runReview(root, {
    type: "idea",
    artifact,
    backend: "heuristic",
    noWrite: true,
  }),
  runDecision(root, {
    artifact,
    backend: "heuristic",
    noWrite: true,
  }),
]).then(([reviewResult, decisionResult]) => {
  assert(reviewResult.output.includes("ARM REVIEW"));
  assert(decisionResult.output.includes("ARM DECISION"));
  console.log("ARM smoke test passed.");
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
