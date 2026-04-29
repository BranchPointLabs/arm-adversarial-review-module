const path = require("path");
const { loadConfig, getOutputDir, getReviewCommand } = require("./config");
const { assembleDecisionPrompt, assembleReviewPrompt } = require("./prompt");
const { getBackend } = require("./backends");
const { enforceSlateOutput, repairSlateOutput } = require("./validate");
const { writeArtifact, writeReviewArtifact } = require("./output");

async function runReview(root, input) {
  const config = input.config || loadConfig(root);
  const type = input.type;
  const command = getReviewCommand(config, type);
  if (!command) {
    throw new Error(`Unknown review type: ${type || "<missing>"}`);
  }

  const artifact = normalizeArtifact(input.artifact);
  const maxFindings = type === "roast" ? 8 : 5;
  const maxWords = input.maxWords || config.output.max_words[type];
  const backend = getBackend(input.backend || config.backend.default);
  const prompt = assembleReviewPrompt(root, config, type, artifact);

  if (input.prompt) {
    return { output: prompt, outPath: null };
  }

  const priorKey = process.env.OPENAI_API_KEY;
  if (input.apiKey) {
    process.env.OPENAI_API_KEY = input.apiKey;
  }

  try {
    let output = await backend.review({
      type,
      artifact,
      config,
      prompt,
      maxFindings,
      maxWords,
      model: input.model || config.backend.model,
    });

    const title = type === "roast" ? "ARM ROAST" : "ARM REVIEW";
    output = repairIfNeeded(output, title, maxWords);

    const outPath = input.noWrite
      ? null
      : writeReviewArtifact(getOutputDir(root, config), artifact, type, output, {
        output: input.output,
      });

    return { output, outPath };
  } finally {
    if (input.apiKey) {
      if (priorKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = priorKey;
      }
    }
  }
}

async function runDecision(root, input) {
  const config = input.config || loadConfig(root);
  const artifact = normalizeArtifact(input.artifact);
  const maxWords = input.maxWords || config.output.max_words.decide;
  const backend = getBackend(input.backend || config.backend.default);
  const prompt = assembleDecisionPrompt(root, config, artifact);

  if (input.prompt) {
    return { output: prompt, outPath: null };
  }

  const priorKey = process.env.OPENAI_API_KEY;
  if (input.apiKey) {
    process.env.OPENAI_API_KEY = input.apiKey;
  }

  try {
    let output = await backend.decide({
      artifact,
      config,
      prompt,
      maxWords,
      model: input.model || config.backend.model,
    });

    output = repairIfNeeded(output, "ARM DECISION", maxWords);

    const outPath = input.noWrite
      ? null
      : writeArtifact(getOutputDir(root, config), artifact, "decision", output, {
        output: input.output,
      });

    return { output, outPath };
  } finally {
    if (input.apiKey) {
      if (priorKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = priorKey;
      }
    }
  }
}

function repairIfNeeded(output, title, maxWords) {
  let errors = enforceSlateOutput(output, maxWords);
  if (errors.length === 0) {
    return output;
  }

  const repaired = repairSlateOutput(output, title, maxWords);
  errors = enforceSlateOutput(repaired, maxWords);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  return repaired;
}

function normalizeArtifact(artifact) {
  if (!artifact || !artifact.text) {
    throw new Error("Artifact text is required.");
  }

  const name = artifact.name || path.basename(artifact.path || "pasted", path.extname(artifact.path || ""));
  return {
    path: artifact.path || "pasted",
    name: name || "pasted",
    text: artifact.text,
  };
}

module.exports = {
  runReview,
  runDecision,
};
