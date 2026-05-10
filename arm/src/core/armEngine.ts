export function summarizeReferenceText(text: string) {
  const cleaned = text.replace(/\r/g, "").trim();
  if (!cleaned) return "No readable text extracted yet.";

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return cleaned.slice(0, 260);
  }

  return sentences.slice(0, 3).join(" ").slice(0, 360);
}
