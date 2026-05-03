import React from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import {
  deleteAllApiKeys,
  hasSavedApiKey,
  llmModelOptions,
  LlmProvider,
  loadLlmSettings,
  saveApiKey,
  saveLlmSettings,
} from "../core/llmSettings";
import { isTauriRuntimeAvailable, projectStore, Project } from "../core/projectStore";
import ProjectWorkspace from "./project/ProjectWorkspace";
import ProjectHome from "./screens/ProjectHome";
import Menu from "./shared/Menu";
import Modal from "./shared/Modal";

export default function App() {
  const navigate = useNavigate();
  const desktopRuntimeReady = isTauriRuntimeAvailable();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);
  const [createBusy, setCreateBusy] = React.useState(false);

  const [selectOpen, setSelectOpen] = React.useState(false);
  const [selectBusy, setSelectBusy] = React.useState(false);
  const [selectStatus, setSelectStatus] = React.useState<string | null>(null);
  const [selectQuery, setSelectQuery] = React.useState("");
  const [selectProjects, setSelectProjects] = React.useState<Project[]>([]);

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [llmProvider, setLlmProvider] = React.useState<LlmProvider>(() => loadLlmSettings().provider);
  const [modelByProvider, setModelByProvider] = React.useState(() => loadLlmSettings().modelByProvider);
  const [apiKeyInput, setApiKeyInput] = React.useState("");
  const [settingsStatus, setSettingsStatus] = React.useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = React.useState(false);
  const [hasOpenAiKey, setHasOpenAiKey] = React.useState(() => hasSavedApiKey("openai"));
  const [hasAnthropicKey, setHasAnthropicKey] = React.useState(() => hasSavedApiKey("anthropic"));

  async function openSelectProject() {
    setSelectOpen(true);
    setSelectBusy(true);
    setSelectStatus(null);
    try {
      setSelectProjects(await projectStore.listProjects());
    } catch (e: any) {
      setSelectStatus(typeof e === "string" ? e : e?.message || "Failed to load projects.");
    } finally {
      setSelectBusy(false);
    }
  }

  async function onCreateProject() {
    const trimmed = createName.trim();
    if (trimmed.length < 2) {
      setCreateStatus("Project name too short.");
      return;
    }

    setCreateBusy(true);
    setCreateStatus(null);
    try {
      const project = await projectStore.createProject(trimmed);
      setCreateOpen(false);
      setCreateName("");
      navigate(`/p/${encodeURIComponent(project.path)}/context`);
    } catch (e: any) {
      setCreateStatus(typeof e === "string" ? e : e?.message || "Create failed.");
    } finally {
      setCreateBusy(false);
    }
  }

  const filteredProjects = selectProjects.filter((project) => {
    const q = selectQuery.trim().toLowerCase();
    if (!q) return true;
    return project.name.toLowerCase().includes(q) || project.path.toLowerCase().includes(q);
  });

  function openLlmSettings() {
    const current = loadLlmSettings();
    setLlmProvider(current.provider);
    setModelByProvider(current.modelByProvider);
    setApiKeyInput("");
    setSettingsStatus(null);
    setHasOpenAiKey(hasSavedApiKey("openai"));
    setHasAnthropicKey(hasSavedApiKey("anthropic"));
    setSettingsOpen(true);
  }

  function onProviderChange(provider: LlmProvider) {
    setLlmProvider(provider);
    const next = { provider, modelByProvider };
    saveLlmSettings(next);
  }

  function onModelChange(model: string) {
    const nextModels = { ...modelByProvider, [llmProvider]: model };
    setModelByProvider(nextModels);
    saveLlmSettings({ provider: llmProvider, modelByProvider: nextModels });
  }

  async function onSaveApiKey() {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setSettingsStatus("API key cannot be empty.");
      return;
    }

    setSettingsBusy(true);
    setSettingsStatus(null);
    try {
      saveLlmSettings({ provider: llmProvider, modelByProvider });
      await saveApiKey(llmProvider, trimmed);
      setApiKeyInput("");
      setHasOpenAiKey(hasSavedApiKey("openai"));
      setHasAnthropicKey(hasSavedApiKey("anthropic"));
      setSettingsStatus(`Saved ${providerLabel(llmProvider)} key.`);
    } catch (e: any) {
      setSettingsStatus(typeof e === "string" ? e : e?.message || "Save failed.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function onDeleteAllKeys() {
    setSettingsBusy(true);
    setSettingsStatus(null);
    try {
      await deleteAllApiKeys();
      setHasOpenAiKey(false);
      setHasAnthropicKey(false);
      setApiKeyInput("");
      setSettingsStatus("Deleted all saved keys.");
    } catch (e: any) {
      setSettingsStatus(typeof e === "string" ? e : e?.message || "Delete failed.");
    } finally {
      setSettingsBusy(false);
    }
  }

  if (!desktopRuntimeReady) {
    return (
      <div className="shell">
        <header className="topbar">
          <div className="topbarInner">
            <button type="button" className="brandButton" onClick={() => navigate("/")}>
              <div className="brand">
                <div className="brandMark">ARM</div>
                <div>
                  <div className="brandTitle">ARM</div>
                  <div className="brandSub">Adversarial Review Module</div>
                </div>
              </div>
            </button>
          </div>
        </header>

        <main className="desktopOnlyState">
          <div className="desktopOnlyCard">
            <div className="landingEyebrow">Desktop App Required</div>
            <h1>ARM runs in the Tauri desktop app.</h1>
            <p>
              This browser view is no longer supported. ARM uses the Rust backend, local project
              folders, SQLite, and desktop file access for its real workflow.
            </p>
            <div className="desktopOnlyCommand">cd arm{"\n"}npm run tauri dev</div>
            <p className="desktopOnlyHint">
              Launch the command above, then use the ARM desktop window instead of this browser tab.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbarInner">
          <button type="button" className="brandButton" onClick={() => navigate("/")}>
            <div className="brand">
            <div className="brandMark">ARM</div>
            <div>
              <div className="brandTitle">ARM</div>
              <div className="brandSub">Adversarial Review Module</div>
            </div>
            </div>
          </button>

          <nav className="appBar" aria-label="App menu">
            <Menu
              label="File"
              items={[
                { label: "LLM Settings", onSelect: openLlmSettings },
              ]}
            />
            <Menu
              label="Projects"
              items={[
                { label: "New Project...", onSelect: () => setCreateOpen(true) },
                { label: "Select Project...", onSelect: openSelectProject },
              ]}
            />
          </nav>
        </div>
      </header>

      {selectOpen ? (
        <Modal
          title="Select Project"
          onClose={() => !selectBusy && setSelectOpen(false)}
          footer={
            <button type="button" className="secondary" disabled={selectBusy} onClick={() => setSelectOpen(false)}>
              Close
            </button>
          }
        >
          <div className="stack">
            <input
              className="textInput"
              value={selectQuery}
              placeholder="Search projects"
              onChange={(e) => setSelectQuery(e.target.value)}
            />
            {selectStatus ? <div className="status">{selectStatus}</div> : null}
            {!selectStatus && selectBusy ? <div className="muted">Loading...</div> : null}
            {!selectBusy ? (
              <div className="list compact">
                {filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="listItem"
                    onClick={() => {
                      setSelectOpen(false);
                      setSelectQuery("");
                      navigate(`/p/${encodeURIComponent(project.path)}/context`);
                    }}
                  >
                    <div className="listTitle">{project.name}</div>
                    <div className="listMeta">{project.path}</div>
                  </button>
                ))}
                {filteredProjects.length === 0 ? <div className="muted">No matching projects.</div> : null}
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {createOpen ? (
        <Modal
          title="New Project"
          onClose={() => !createBusy && setCreateOpen(false)}
          footer={
            <>
              <button type="button" className="secondary" disabled={createBusy} onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary" disabled={createBusy} onClick={onCreateProject}>
                Create
              </button>
            </>
          }
        >
          <div className="stack">
            <input
              autoFocus
              className="textInput"
              value={createName}
              placeholder="Project name"
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCreateProject();
              }}
              disabled={createBusy}
            />
            {createStatus ? <div className="status">{createStatus}</div> : null}
          </div>
        </Modal>
      ) : null}

      {settingsOpen ? (
        <Modal
          title="LLM Settings"
          onClose={() => !settingsBusy && setSettingsOpen(false)}
          footer={
            <>
              <button type="button" className="secondary" disabled={settingsBusy} onClick={onDeleteAllKeys}>
                Delete All Keys
              </button>
              <button type="button" className="primary" disabled={settingsBusy} onClick={onSaveApiKey}>
                Save Key
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="settingsSection">
              <div className="settingsLabel">Provider</div>
              <div className="segmentedControl">
                <button
                  type="button"
                  className={"segmentedPill" + (llmProvider === "openai" ? " active" : "")}
                  onClick={() => onProviderChange("openai")}
                >
                  OpenAI
                </button>
                <button
                  type="button"
                  className={"segmentedPill" + (llmProvider === "anthropic" ? " active" : "")}
                  onClick={() => onProviderChange("anthropic")}
                >
                  Anthropic
                </button>
              </div>
            </div>

            <div className="settingsSection">
              <div className="settingsLabel">Model</div>
              <select
                className="selectInput"
                value={modelByProvider[llmProvider]}
                onChange={(e) => onModelChange(e.target.value)}
              >
                {llmModelOptions[llmProvider].map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <div className="settingsSection">
              <div className="settingsLabel">API Key</div>
              <input
                className="textInput"
                type="password"
                value={apiKeyInput}
                placeholder={`Add ${providerLabel(llmProvider)} API key`}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              <div className="settingsMeta">
                {hasOpenAiKey ? "OpenAI key saved." : "OpenAI key not saved."} {hasAnthropicKey ? "Anthropic key saved." : "Anthropic key not saved."}
              </div>
            </div>

            {settingsStatus ? <div className="status">{settingsStatus}</div> : null}
          </div>
        </Modal>
      ) : null}

      <Routes>
        <Route path="/" element={<ProjectHome onCreateProject={() => setCreateOpen(true)} />} />
        <Route path="/p/:projectPath/*" element={<ProjectWorkspace />} />
      </Routes>
    </div>
  );
}

function providerLabel(provider: LlmProvider) {
  return provider === "openai" ? "OpenAI" : "Anthropic";
}
