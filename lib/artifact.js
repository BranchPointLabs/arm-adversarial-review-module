const fs = require("fs");
const path = require("path");

function readArtifact(root, file, options = {}) {
  if (options.stdin) {
    const text = fs.readFileSync(0, "utf8");
    return {
      path: "stdin",
      name: "stdin",
      text,
    };
  }

  if (!file) {
    throw new Error("Missing file path.");
  }

  const fullPath = path.resolve(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${file}`);
  }

  return {
    path: fullPath,
    name: path.basename(file, path.extname(file)),
    text: fs.readFileSync(fullPath, "utf8"),
  };
}

module.exports = {
  readArtifact,
};
