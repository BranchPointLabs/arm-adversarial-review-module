export type LlmProvider = "openai" | "anthropic";

export type LlmSettings = {
  provider: LlmProvider;
  modelByProvider: Record<LlmProvider, string>;
};

type EncryptedPayload = {
  iv: string;
  cipherText: string;
};

const settingsStorageKey = "arm.llm.settings.v1";
const keyStoragePrefix = "arm.llm.key.";
const dbName = "arm-llm-vault";
const storeName = "keys";
const masterKeyId = "master";

export const llmModelOptions: Record<LlmProvider, string[]> = {
  openai: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-4.1"],
  anthropic: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-7-sonnet-20250219"],
};

export function loadLlmSettings(): LlmSettings {
  const fallback: LlmSettings = {
    provider: "openai",
    modelByProvider: {
      openai: "gpt-5.4",
      anthropic: "claude-sonnet-4-20250514",
    },
  };

  const raw = window.localStorage.getItem(settingsStorageKey);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    return {
      provider: parsed.provider === "anthropic" ? "anthropic" : "openai",
      modelByProvider: {
        openai: sanitizeModel("openai", parsed.modelByProvider?.openai) || fallback.modelByProvider.openai,
        anthropic: sanitizeModel("anthropic", parsed.modelByProvider?.anthropic) || fallback.modelByProvider.anthropic,
      },
    };
  } catch {
    return fallback;
  }
}

export function saveLlmSettings(settings: LlmSettings) {
  window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
}

export function hasSavedApiKey(provider: LlmProvider) {
  return !!window.localStorage.getItem(keyStoragePrefix + provider);
}

export async function saveApiKey(provider: LlmProvider, apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("API key cannot be empty.");
  const encrypted = await encryptString(trimmed);
  window.localStorage.setItem(keyStoragePrefix + provider, JSON.stringify(encrypted));
}

export async function getApiKey(provider: LlmProvider) {
  const raw = window.localStorage.getItem(keyStoragePrefix + provider);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as EncryptedPayload;
    return await decryptString(payload);
  } catch {
    return null;
  }
}

export async function deleteAllApiKeys() {
  window.localStorage.removeItem(keyStoragePrefix + "openai");
  window.localStorage.removeItem(keyStoragePrefix + "anthropic");
}

async function encryptString(value: string): Promise<EncryptedPayload> {
  const cryptoKey = await getOrCreateMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded);

  return {
    iv: bytesToBase64(iv),
    cipherText: bytesToBase64(new Uint8Array(encrypted)),
  };
}

async function decryptString(payload: EncryptedPayload): Promise<string> {
  const cryptoKey = await getOrCreateMasterKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
    cryptoKey,
    base64ToBytes(payload.cipherText)
  );
  return new TextDecoder().decode(decrypted);
}

async function getOrCreateMasterKey() {
  const db = await openVaultDb();

  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(masterKeyId);
    request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
    request.onerror = () => reject(request.error);
  });
  if (existing) return existing;

  const created = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(created, masterKeyId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  return created;
}

async function openVaultDb() {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return btoa(out);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function sanitizeModel(provider: LlmProvider, model: string | undefined) {
  if (model && llmModelOptions[provider].includes(model)) return model;
  return null;
}
