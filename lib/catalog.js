const fs = require("fs");
const path = require("path");

function listMarkdownFiles(root, dir) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) {
    return [];
  }

  return fs
    .readdirSync(fullDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.basename(file, ".md"))
    .sort();
}

function readMarkdownFile(root, dir, name) {
  const safeName = path.basename(name || "", ".md");
  if (!safeName) {
    return null;
  }

  const fullPath = path.join(root, dir, `${safeName}.md`);
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return fs.readFileSync(fullPath, "utf8").trim();
}

module.exports = {
  listMarkdownFiles,
  readMarkdownFile,
};
