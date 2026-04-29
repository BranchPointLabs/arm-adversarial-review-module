const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG = {
  style: "slate",
  backend: {
    default: "heuristic",
    model: null,
  },
  output: {
    default_path: "docs/arm",
    max_words: {
      idea: 500,
      prd: 800,
      rfc: 900,
      executive: 700,
      roast: 1200,
      decide: 300,
    },
  },
  commands: {
    review_idea: { personas: ["critic", "cpo", "customer", "pm"] },
    review_prd: { personas: ["critic", "cpo", "pm", "customer", "qa"] },
    review_rfc: { personas: ["critic", "cto", "architect", "security", "qa"] },
    review_executive: { personas: ["critic", "cpo", "cto"] },
    review_roast: { personas: ["critic", "cpo", "cto", "pm", "architect", "security", "qa", "customer"] },
    decide: { personas: ["critic", "cpo", "cto"] },
  },
  prompts: {
    system: "prompts/system.md",
    review: "prompts/review.md",
    decide: "prompts/decide.md",
  },
  schemas: {
    review: "schemas/review-output.md",
    decision: "schemas/decision-output.md",
  },
};

function loadConfig(root) {
  const configPath = path.join(root, "arm.config.yaml");
  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  const raw = fs.readFileSync(configPath, "utf8");
  return merge(DEFAULT_CONFIG, parseArmConfig(raw));
}

function getReviewCommand(config, type) {
  return config.commands[`review_${type}`];
}

function getOutputDir(root, config) {
  return path.resolve(root, config.output.default_path || DEFAULT_CONFIG.output.default_path);
}

function parseArmConfig(raw) {
  const result = {};
  const stack = [{ indent: -1, value: result }];
  const lines = raw.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      continue;
    }

    const indent = line.match(/^\s*/)[0].length;
    const trimmed = line.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].value;

    if (trimmed.startsWith("- ")) {
      const item = parseScalar(trimmed.slice(2));
      if (Array.isArray(parent)) {
        parent.push(item);
      }
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();

    if (!value) {
      const next = nextContentIsList(lines, index, indent) ? [] : {};
      parent[key] = next;
      stack.push({ indent, value: next });
      continue;
    }

    parent[key] = parseScalar(value);
  }

  normalizeListBlocks(result);
  return result;
}

function nextContentIsList(lines, currentIndex, currentIndent) {
  for (let index = currentIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      continue;
    }

    const indent = line.match(/^\s*/)[0].length;
    if (indent <= currentIndent) {
      return false;
    }

    return line.trim().startsWith("- ");
  }

  return false;
}

function normalizeListBlocks(value) {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object" && !Array.isArray(child)) {
      const keys = Object.keys(child);
      if (keys.every((item) => /^\d+$/.test(item))) {
        value[key] = keys.sort((a, b) => Number(a) - Number(b)).map((item) => child[item]);
      } else {
        normalizeListBlocks(child);
      }
    }
  }
}

function parseScalar(value) {
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

function merge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override === undefined ? base : override;
  }

  if (!isObject(base) || !isObject(override)) {
    return override === undefined ? base : override;
  }

  const output = { ...base };
  for (const [key, value] of Object.entries(override)) {
    output[key] = merge(base[key], value);
  }
  return output;
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  loadConfig,
  getOutputDir,
  getReviewCommand,
};
