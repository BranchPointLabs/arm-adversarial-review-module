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
import { isTauriRuntimeAvailable, projectStore } from "../core/projectStore";
import ProjectWorkspace from "./project/ProjectWorkspace";
import ProjectHome from "./screens/ProjectHome";
import Modal from "./shared/Modal";

export default function App() {
  const navigate = useNavigate();
  const desktopRuntimeReady = isTauriRuntimeAvailable();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createStatus, setCreateStatus] = React.useState<string | null>(null);
  const [createBusy, setCreateBusy] = React.useState(false);

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [llmProvider, setLlmProvider] = React.useState<LlmProvider>(() => loadLlmSettings().provider);
  const [modelByProvider, setModelByProvider] = React.useState(() => loadLlmSettings().modelByProvider);
  const [apiKeyInput, setApiKeyInput] = React.useState("");
  const [settingsStatus, setSettingsStatus] = React.useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = React.useState(false);
  const [hasOpenAiKey, setHasOpenAiKey] = React.useState(() => hasSavedApiKey("openai"));
  const [hasAnthropicKey, setHasAnthropicKey] = React.useState(() => hasSavedApiKey("anthropic"));

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
            <div className="brandMark">ARM</div>
          </button>

          <div className="headerIdentity" aria-label="ARM Adversarial Review Module">
            <div className="brandTitle">ARM</div>
            <div className="brandSub">Adversarial Review Module</div>
          </div>

          <nav className="appBar" aria-label="App menu">
            <button
              type="button"
              className="iconButton appBarSettingsButton"
              aria-label="LLM Settings"
              title="LLM Settings"
              onClick={openLlmSettings}
            >
              <SettingsIcon />
            </button>
          </nav>
        </div>
      </header>

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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M6.9 1.8h2.2l.4 1.6c.4.1.7.3 1 .5l1.5-.5 1.1 1.9-1.2 1.1c.1.4.1.8 0 1.2l1.2 1.1-1.1 1.9-1.5-.5c-.3.2-.6.4-1 .5l-.4 1.6H6.9l-.4-1.6c-.4-.1-.7-.3-1-.5l-1.5.5-1.1-1.9 1.2-1.1C4 8 4 7.6 4.1 7.2L2.9 6.1 4 4.2l1.5.5c.3-.2.6-.4 1-.5z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <circle cx="8" cy="8" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
