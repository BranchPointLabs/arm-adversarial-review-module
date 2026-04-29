function getBackend(name) {
  if (name === "heuristic") {
    return require("./heuristic");
  }

  if (name === "openai") {
    return require("./openai");
  }

  throw new Error(`Unknown backend: ${name}`);
}

module.exports = {
  getBackend,
};
