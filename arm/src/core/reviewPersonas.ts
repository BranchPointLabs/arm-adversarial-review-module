import cpoPersona from "./cpo.md?raw";
import engPersona from "./eng.md?raw";

export function personaForMode(mode: "product" | "technical") {
  return (mode === "product" ? cpoPersona : engPersona).trim();
}
