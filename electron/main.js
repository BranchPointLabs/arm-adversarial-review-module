const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { runDecision, runReview } = require("../lib/engine");

const ROOT = path.resolve(__dirname, "..");

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#f6f4ef",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("arm:open-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Documents", extensions: ["md", "txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  return {
    path: filePath,
    name: path.basename(filePath, path.extname(filePath)),
    text: fs.readFileSync(filePath, "utf8"),
  };
});

ipcMain.handle("arm:save-output", async (_event, content) => {
  const result = await dialog.showSaveDialog({
    defaultPath: "arm-review.md",
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  fs.writeFileSync(result.filePath, `${content.trim()}\n`, "utf8");
  return result.filePath;
});

ipcMain.handle("arm:review", async (_event, payload) => {
  const artifact = makeArtifact(payload);
  return runReview(ROOT, {
    type: payload.type,
    artifact,
    backend: payload.backend,
    model: payload.model,
    maxWords: payload.maxWords,
    apiKey: payload.apiKey,
    noWrite: true,
  });
});

ipcMain.handle("arm:decide", async (_event, payload) => {
  const artifact = makeArtifact(payload);
  return runDecision(ROOT, {
    artifact,
    backend: payload.backend,
    model: payload.model,
    maxWords: payload.maxWords,
    apiKey: payload.apiKey,
    noWrite: true,
  });
});

function makeArtifact(payload) {
  return {
    path: payload.path || "pasted",
    name: payload.name || "pasted",
    text: payload.text || "",
  };
}
