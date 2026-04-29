const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const required = [
  "electron/main.js",
  "electron/preload.js",
  "electron/renderer/index.html",
  "electron/renderer/renderer.js",
  "electron/renderer/styles.css",
];

for (const file of required) {
  assert(fs.existsSync(path.join(root, file)), `${file} missing`);
}

const main = fs.readFileSync(path.join(root, "electron/main.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron/preload.js"), "utf8");
const renderer = fs.readFileSync(path.join(root, "electron/renderer/renderer.js"), "utf8");
const html = fs.readFileSync(path.join(root, "electron/renderer/index.html"), "utf8");

assert(main.includes("ipcMain.handle(\"arm:review\""));
assert(main.includes("ipcMain.handle(\"arm:decide\""));
assert(preload.includes("contextBridge.exposeInMainWorld(\"arm\""));
assert(renderer.includes("window.arm.review"));
assert(renderer.includes("window.arm.decide"));
assert(html.includes("ARM Reviewer"));

console.log("ARM desktop smoke test passed.");
