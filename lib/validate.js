function validateConfig(config) {
  const errors = [];

  requireObject(config, "commands", errors);
  requireObject(config, "output", errors);
  requireObject(config.output, "max_words", errors);

  for (const type of ["idea", "prd", "rfc", "executive", "roast"]) {
    const command = config.commands && config.commands[`review_${type}`];
    if (!command || !Array.isArray(command.personas) || command.personas.length === 0) {
      errors.push(`commands.review_${type}.personas must be a non-empty list`);
    }
  }

  if (!config.commands || !config.commands.decide || !Array.isArray(config.commands.decide.personas)) {
    errors.push("commands.decide.personas must be a list");
  }

  return errors;
}

function enforceSlateOutput(output, maxWords) {
  const errors = [];
  const trimmed = output.trim();

  if (!trimmed.startsWith("===============") || !trimmed.endsWith("===============")) {
    errors.push("output must be wrapped in Slate attention block delimiters");
  }

  if (maxWords && wordCount(output) > maxWords) {
    errors.push(`output exceeds max word budget: ${wordCount(output)} > ${maxWords}`);
  }

  return errors;
}

function repairSlateOutput(output, title, maxWords) {
  const raw = String(output || "").trim();
  const body = extractUsefulLines(raw, maxWords);

  return [
    "===============",
    title,
    "",
    body.length > 0 ? body.join("\n") : "1. Output was empty. Re-run review.",
    "===============",
  ].join("\n");
}

function extractUsefulLines(raw, maxWords) {
  const withoutFence = raw
    .replace(/^=+\s*/g, "")
    .replace(/\s*=+$/g, "")
    .trim();

  const lines = withoutFence
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^```/.test(line))
    .filter((line) => !/^ARM (REVIEW|ROAST|DECISION|STATUS|VALIDATE)$/i.test(line));

  const compact = [];
  let count = 0;
  const limit = maxWords || 500;

  for (const line of lines) {
    const words = wordCount(line);
    if (count + words > limit) {
      break;
    }

    compact.push(line);
    count += words;
  }

  return ensureNumbered(compact);
}

function ensureNumbered(lines) {
  if (lines.some((line) => /^\d+\./.test(line))) {
    return lines;
  }

  return lines.map((line, index) => `${index + 1}. ${line}`);
}

function requireObject(parent, key, errors) {
  if (!parent || !parent[key] || typeof parent[key] !== "object") {
    errors.push(`${key} must be configured`);
  }
}

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

module.exports = {
  validateConfig,
  enforceSlateOutput,
  repairSlateOutput,
  wordCount,
};
