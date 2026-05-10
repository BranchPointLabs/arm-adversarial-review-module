import React from "react";
import { summarizeReferenceText } from "../../core/armEngine";
import { ProjectReference, projectStore } from "../../core/projectStore";

export const acceptedReferenceTypes = [
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".csv",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".rs",
  ".go",
  ".py",
  ".java",
  ".cs",
  ".html",
  ".css",
];

export function useReferenceWorkflow(props: {
  projectPath: string;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string | null) => void;
  refreshAll: () => Promise<void>;
}) {
  const [repositoryPanelOpen, setRepositoryPanelOpen] = React.useState(false);
  const [repositoryInput, setRepositoryInput] = React.useState("");
  const [repositoryProcessing, setRepositoryProcessing] = React.useState(false);
  const [repositoryStatus, setRepositoryStatus] = React.useState<string | null>(null);

  async function handlePickedFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const referenceInputs = await Promise.all(
      Array.from(fileList)
        .filter((file) => isReferenceFile(file.name))
        .map(async (file) => {
          const extractedText = await safeReadText(file);
          return {
            fileName: file.name,
            filePath: "webkitRelativePath" in file && file.webkitRelativePath ? file.webkitRelativePath : file.name,
            extractedText,
            summary: extractedText ? summarizeReferenceText(extractedText) : null,
          };
        }),
    );

    if (referenceInputs.length === 0) {
      props.setStatus("No supported text references were selected.");
      return;
    }

    props.setBusy(true);
    try {
      await projectStore.addReferences(props.projectPath, referenceInputs);
      props.setStatus("References added.");
      await props.refreshAll();
    } catch (error: any) {
      props.setStatus(typeof error === "string" ? error : error?.message || "Failed to add references.");
    } finally {
      props.setBusy(false);
    }
  }

  async function toggleReference(reference: ProjectReference) {
    props.setBusy(true);
    try {
      await projectStore.updateReference(props.projectPath, reference.id, { isSelected: !reference.isSelected });
      await props.refreshAll();
    } catch (error: any) {
      props.setStatus(typeof error === "string" ? error : error?.message || "Reference update failed.");
    } finally {
      props.setBusy(false);
    }
  }

  async function summarizeReference(reference: ProjectReference) {
    const summary = summarizeReferenceText(reference.extractedText || "");
    props.setBusy(true);
    try {
      await projectStore.updateReference(props.projectPath, reference.id, { summary });
      await props.refreshAll();
    } catch (error: any) {
      props.setStatus(typeof error === "string" ? error : error?.message || "Summary failed.");
    } finally {
      props.setBusy(false);
    }
  }

  async function removeReference(reference: ProjectReference) {
    props.setBusy(true);
    try {
      await projectStore.removeReference(props.projectPath, reference.id);
      await props.refreshAll();
    } catch (error: any) {
      props.setStatus(typeof error === "string" ? error : error?.message || "Remove failed.");
    } finally {
      props.setBusy(false);
    }
  }

  async function processRepositoryReferenceNow() {
    const trimmed = repositoryInput.trim();
    if (!trimmed) {
      setRepositoryStatus("Enter a GitHub repo URL or git clone command.");
      return;
    }

    setRepositoryProcessing(true);
    setRepositoryStatus("Cloning and processing repository...");
    try {
      const reference = await projectStore.processRepositoryReference(props.projectPath, trimmed);
      setRepositoryInput("");
      setRepositoryStatus(`${reference.fileName} indexed as a repository reference.`);
      await props.refreshAll();
    } catch (error: any) {
      setRepositoryStatus(typeof error === "string" ? error : error?.message || "Repository processing failed.");
    } finally {
      setRepositoryProcessing(false);
    }
  }

  return {
    repositoryPanelOpen,
    repositoryInput,
    repositoryProcessing,
    repositoryStatus,
    setRepositoryPanelOpen,
    setRepositoryInput,
    handlePickedFiles,
    toggleReference,
    summarizeReference,
    removeReference,
    processRepositoryReferenceNow,
  };
}

function isReferenceFile(name: string) {
  const lowered = name.toLowerCase();
  return acceptedReferenceTypes.some((suffix) => lowered.endsWith(suffix));
}

async function safeReadText(file: File) {
  try {
    const text = await file.text();
    return text.slice(0, 16000);
  } catch {
    return null;
  }
}
