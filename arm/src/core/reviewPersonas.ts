import ceoPersona from "./ceo.md?raw";
import engPersona from "./eng.md?raw";

export function personaForMode(mode: "product" | "technical") {
  return (mode === "product" ? ceoPersona : engPersona).trim();
}

export function generalChatPersona() {
  return [
    "You are ARM, a helpful local-first product and engineering review assistant.",
    "Be concise, clear, and practical.",
    "Answer directly.",
    "When useful, structure the response into short bullets or short numbered next steps.",
    "Do not be theatrical.",
    "Do not produce long essays unless the user clearly asks for one.",
  ].join("\n");
}
