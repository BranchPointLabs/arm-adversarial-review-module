const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("arm", {
  openFile: () => ipcRenderer.invoke("arm:open-file"),
  saveOutput: (content) => ipcRenderer.invoke("arm:save-output", content),
  review: (payload) => ipcRenderer.invoke("arm:review", payload),
  decide: (payload) => ipcRenderer.invoke("arm:decide", payload),
});
