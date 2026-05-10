import ceoPersona from "./ceo.md?raw";
import cpoPersona from "./cpo.md?raw";
import engPersona from "./eng.md?raw";
import securityPersona from "./security.md?raw";

export type ReviewPersonaMode = "product" | "technical" | "security";

export function personaForMode(mode: ReviewPersonaMode) {
  if (mode === "product") return cpoPersona.trim();
  if (mode === "security") return securityPersona.trim();
  return engPersona.trim();
}

export function generalChatPersona() {
  return ceoPersona.trim();
}
