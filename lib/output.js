const fs = require("fs");
const path = require("path");

function writeArtifact(outputDir, artifact, suffix, content, options = {}) {
  if (options.noWrite) {
    return null;
  }

  const outPath = resolveOutputPath(outputDir, artifact.name, suffix, options.output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${content}\n`, "utf8");
  return outPath;
}

function writeReviewArtifact(outputDir, artifact, type, content, options = {}) {
  const suffix = artifact.name.toLowerCase() === type ? "review" : `${type}-review`;
  return writeArtifact(outputDir, artifact, suffix, content, options);
}

function resolveOutputPath(outputDir, base, suffix, explicitOutput) {
  if (explicitOutput) {
    return path.resolve(explicitOutput);
  }

  return path.join(outputDir, `${base}-${suffix}.md`);
}

module.exports = {
  writeArtifact,
  writeReviewArtifact,
};
