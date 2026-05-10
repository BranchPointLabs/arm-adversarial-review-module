export type PlanPage = {
  id: string;
  title: string;
  kind: "document" | "diagram";
  content: string;
  context?: string;
};

export function buildPlanPages(markdown: string): PlanPage[] {
  const pages: PlanPage[] = [];
  const majorSections = splitPlanMajorSections(markdown);

  for (const section of majorSections) {
    const parts = section.content.split(/```mermaid\s*([\s\S]*?)```/gi);
    const textParts: string[] = [];
    const diagramPages: PlanPage[] = [];

    for (let index = 0; index < parts.length; index += 1) {
      if (index % 2 === 0) {
        const text = parts[index].trim();
        if (text) textParts.push(text);
        continue;
      }

      const mermaid = parts[index].trim();
      if (mermaid) {
        diagramPages.push({
          id: `${section.id}-diagram-${index}`,
          title: section.title === "Plan Summary"
            ? "Initiative Relationship Diagram"
            : `${nearestPlanSubject(parts[index - 1] || section.title)} Diagram`,
          kind: "diagram",
          content: mermaid,
          context: `${section.content}\n\n${markdown}`,
        });
      }
    }

    const text = textParts.join("\n\n").trim();
    if (text) {
      pages.push({
        id: section.id,
        title: section.title,
        kind: "document",
        content: text,
      });
    }
    pages.push(...diagramPages);
  }

  return pages.length > 0
    ? pages
    : [{ id: "plan", title: "Plan", kind: "document", content: markdown.trim() || "No plan content yet." }];
}

export function replacePlanPageMarkdown(markdown: string, page: PlanPage, nextContent: string) {
  if (page.kind !== "document") return markdown;
  const sections = splitPlanMajorSections(markdown);
  const section = sections.find((item) => item.title === page.title);
  if (!section) return markdown;

  const diagrams = [...section.content.matchAll(/```mermaid\s*[\s\S]*?```/gi)].map((match) => match[0].trim());
  const cleanedContent = sanitizePlanPageDraft(nextContent, page.title);
  const nextSection = [cleanedContent, ...diagrams].filter(Boolean).join("\n\n").trim();
  return `${markdown.slice(0, section.start)}${nextSection}${markdown.slice(section.end)}`;
}

function sanitizePlanPageDraft(value: string, title: string) {
  const withoutDiagrams = value.replace(/```mermaid\s*[\s\S]*?```/gi, "").trim();
  if (new RegExp(`^##\\s+${escapeRegExp(title)}\\s*$`, "im").test(withoutDiagrams)) {
    return withoutDiagrams;
  }
  return `## ${title}\n${withoutDiagrams}`.trim();
}

function splitPlanMajorSections(markdown: string) {
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) {
    return [{ id: "plan", title: firstMarkdownHeading(markdown) || "Plan", start: 0, end: markdown.length, content: markdown }];
  }

  return matches.map((match, index) => {
    const start = match.index || 0;
    const next = matches[index + 1]?.index ?? markdown.length;
    const title = match[1].trim();
    return {
      id: createStablePageId(title, index),
      title,
      start,
      end: next,
      content: markdown.slice(start, next).trim(),
    };
  });
}

function firstMarkdownHeading(markdown: string) {
  return /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() || null;
}

function nearestPlanSubject(text: string) {
  const headings = [...text.matchAll(/^#{3,4}\s+(.+)$/gm)];
  const heading = headings[headings.length - 1]?.[1]?.trim();
  return heading ? heading.replace(/^(Initiative|Epic|Ticket)\s+[\d.]+:\s*/i, "") : "Plan";
}

function createStablePageId(title: string, index: number) {
  return `${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page"}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
