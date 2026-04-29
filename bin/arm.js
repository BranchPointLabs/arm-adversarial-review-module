#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { loadConfig, getOutputDir, getReviewCommand } = require("../lib/config");
const { assembleReviewPrompt, assembleDecisionPrompt } = require("../lib/prompt");
const { listMarkdownFiles, readMarkdownFile } = require("../lib/catalog");
const { readArtifact } = require("../lib/artifact");
const { parseOptions } = require("../lib/options");
const { validateConfig } = require("../lib/validate");
const { runDecision, runReview } = require("../lib/engine");

const ROOT = process.cwd();
const CONFIG = loadConfig(ROOT);
const OUTPUT_DIR = getOutputDir(ROOT, CONFIG);

async function main(argv) {
  const parsed = parseOptions(argv);
  const [command, subcommand, file] = parsed.positionals;
  const options = parsed.options;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "init") {
    initProject();
    return;
  }

  if (command === "status") {
    status();
    return;
  }

  if (command === "validate") {
    validate();
    return;
  }

  if (command === "review") {
    await review(subcommand, file, options);
    return;
  }

  if (command === "decide") {
    await decide(subcommand, options);
    return;
  }

  if (command === "personas") {
    personas(subcommand, file);
    return;
  }

  if (command === "checklist") {
    checklist(subcommand);
    return;
  }

  fail(`Unknown command: ${command}`);
}

function printHelp() {
  console.log(`ARM

Usage:
  arm init
  arm status
  arm validate
  arm review idea <file>
  arm review prd <file>
  arm review rfc <file>
  arm review executive <file>
  arm review roast <file>
  arm decide <file>
  arm personas list
  arm personas show <name>
  arm checklist <type>

Options:
  --prompt   Print assembled prompt instead of heuristic output.
  --backend <name>      Backend: heuristic, openai.
  --model <name>        Backend model name.
  --max-words <number>  Override word budget.
  --output <file>       Write to a specific file.
  --no-write            Print only.
  --stdin               Read artifact from stdin.
`);
}

function initProject() {
  ensureDir(OUTPUT_DIR);
  console.log(`Initialized ARM output directory: ${relative(OUTPUT_DIR)}`);
}

function status() {
  const personas = listMarkdownFiles(ROOT, "personas");
  const checklists = Object.keys(CONFIG.checklists || {}).sort();
  const prompts = Object.values(CONFIG.prompts || {}).filter((file) => fs.existsSync(path.join(ROOT, file)));
  const outputs = fs.existsSync(OUTPUT_DIR)
    ? fs.readdirSync(OUTPUT_DIR).filter((file) => file.endsWith(".md")).sort()
    : [];

  console.log([
    "===============",
    "ARM STATUS",
    "",
    `Config: ${fs.existsSync(path.join(ROOT, "arm.config.yaml")) ? "found" : "default"}`,
    `Style: ${CONFIG.style}`,
    `Personas: ${personas.length}`,
    `Checklists: ${checklists.length}`,
    `Prompts: ${prompts.length}`,
    `Output: ${relative(OUTPUT_DIR)}`,
    `Artifacts: ${outputs.length}`,
    `Backend: ${CONFIG.backend.default}`,
    "",
    "Next Step:",
    outputs.length > 0
      ? "1. Run review or inspect generated artifacts."
      : "1. Run arm review idea examples/idea.md.",
    "===============",
  ].join("\n"));
}

function validate() {
  const errors = validateConfig(CONFIG);
  if (errors.length > 0) {
    console.log([
      "===============",
      "ARM VALIDATE",
      "",
      "Verdict: Needs Revision",
      "",
      "Issues:",
      ...errors.map((error, index) => `${index + 1}. ${error}`),
      "===============",
    ].join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log([
    "===============",
    "ARM VALIDATE",
    "",
    "Verdict: Approved",
    "",
    "Issues:",
    "1. None.",
    "===============",
  ].join("\n"));
}

async function review(type, file, options) {
  const command = getReviewCommand(CONFIG, type);
  if (!command) {
    fail(`Unknown review type: ${type || "<missing>"}`);
  }

  const artifact = readArtifact(ROOT, file, options);
  if (options.prompt) {
    console.log(assembleReviewPrompt(ROOT, CONFIG, type, artifact));
    return;
  }

  const result = await runReview(ROOT, {
    type,
    artifact,
    config: CONFIG,
    maxWords: options.maxWords || CONFIG.output.max_words[type],
    backend: options.backend,
    model: options.model || CONFIG.backend.model,
    noWrite: options.noWrite,
    output: options.output,
  });

  console.log(result.output);
  if (result.outPath) {
    console.log(`\nWrote: ${relative(result.outPath)}`);
  }
}

async function decide(file, options) {
  const artifact = readArtifact(ROOT, file, options);
  if (options.prompt) {
    console.log(assembleDecisionPrompt(ROOT, CONFIG, artifact));
    return;
  }

  const result = await runDecision(ROOT, {
    artifact,
    config: CONFIG,
    maxWords: options.maxWords || CONFIG.output.max_words.decide,
    backend: options.backend,
    model: options.model || CONFIG.backend.model,
    noWrite: options.noWrite,
    output: options.output,
  });

  console.log(result.output);
  if (result.outPath) {
    console.log(`\nWrote: ${relative(result.outPath)}`);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function relative(fullPath) {
  return path.relative(ROOT, fullPath) || ".";
}

function fail(message) {
  console.error(`ARM error: ${message}`);
  process.exit(1);
}

function personas(action, name) {
  if (action === "list") {
    console.log(listMarkdownFiles(ROOT, "personas").join("\n"));
    return;
  }

  if (action === "show") {
    const content = readMarkdownFile(ROOT, "personas", name);
    if (!content) {
      fail(`Persona not found: ${name || "<missing>"}`);
    }

    console.log(content);
    return;
  }

  fail(`Unknown personas command: ${action || "<missing>"}`);
}

function checklist(type) {
  const configuredPath = CONFIG.checklists && CONFIG.checklists[type];
  if (!configuredPath) {
    fail(`Checklist not found: ${type || "<missing>"}`);
  }

  const fullPath = path.join(ROOT, configuredPath);
  if (!fs.existsSync(fullPath)) {
    fail(`Checklist file missing: ${configuredPath}`);
  }

  console.log(fs.readFileSync(fullPath, "utf8").trim());
}

main(process.argv.slice(2)).catch((error) => fail(error.message));
