import ceoPersona from "./ceo.md?raw";
import cpoPersona from "./cpo.md?raw";
import engPersona from "./eng.md?raw";

export function personaForMode(mode: "product" | "technical") {
  return (mode === "product" ? cpoPersona : engPersona).trim();
}

export function generalChatPersona() {
  return ceoPersona.trim();
}
