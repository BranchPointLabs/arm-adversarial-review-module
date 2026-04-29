const state = {
  artifactPath: "",
  artifactName: "pasted",
  output: "",
};

const els = {
  artifact: document.getElementById("artifact"),
  type: document.getElementById("type"),
  backend: document.getElementById("backend"),
  model: document.getElementById("model"),
  maxWords: document.getElementById("maxWords"),
  apiKey: document.getElementById("apiKey"),
  output: document.getElementById("output"),
  status: document.getElementById("status"),
  openFile: document.getElementById("openFile"),
  review: document.getElementById("review"),
  roast: document.getElementById("roast"),
  decide: document.getElementById("decide"),
  copy: document.getElementById("copy"),
  save: document.getElementById("save"),
};

els.openFile.addEventListener("click", async () => {
  const file = await window.arm.openFile();
  if (!file) return;

  state.artifactPath = file.path;
  state.artifactName = file.name;
  els.artifact.value = file.text;
  setStatus(`Loaded ${file.name}.`);
});

els.review.addEventListener("click", () => runReview(els.type.value));
els.roast.addEventListener("click", () => {
  els.type.value = "roast";
  runReview("roast");
});
els.decide.addEventListener("click", runDecision);

els.copy.addEventListener("click", async () => {
  await navigator.clipboard.writeText(state.output || els.output.textContent);
  setStatus("Copied.");
});

els.save.addEventListener("click", async () => {
  const filePath = await window.arm.saveOutput(state.output || els.output.textContent);
  if (filePath) setStatus(`Saved ${filePath}.`);
});

async function runReview(type) {
  await run("Reviewing.", () => window.arm.review(payload({ type })));
}

async function runDecision() {
  await run("Deciding.", () => window.arm.decide(payload({})));
}

async function run(message, action) {
  if (!els.artifact.value.trim()) {
    setStatus("Artifact required.");
    return;
  }

  setStatus(message);
  setBusy(true);

  try {
    const result = await action();
    state.output = result.output;
    els.output.textContent = result.output;
    setStatus("Done.");
  } catch (error) {
    setStatus(error.message || "Review failed.");
  } finally {
    setBusy(false);
  }
}

function payload(extra) {
  return {
    path: state.artifactPath || "pasted",
    name: state.artifactName || "pasted",
    text: els.artifact.value,
    type: extra.type,
    backend: els.backend.value,
    model: els.model.value.trim(),
    maxWords: Number(els.maxWords.value) || 700,
    apiKey: els.apiKey.value.trim(),
  };
}

function setBusy(isBusy) {
  els.review.disabled = isBusy;
  els.roast.disabled = isBusy;
  els.decide.disabled = isBusy;
}

function setStatus(message) {
  els.status.textContent = message;
}
