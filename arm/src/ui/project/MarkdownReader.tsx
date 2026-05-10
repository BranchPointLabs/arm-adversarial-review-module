import React from "react";

export default function MarkdownReader(props: { markdown: string }) {
  return (
    <div className="markdownReader">
      {parseMarkdownBlocks(props.markdown).map((block, index) => {
        if (block.type === "heading") {
          const Heading = `h${Math.min(4, Math.max(2, block.level))}` as keyof JSX.IntrinsicElements;
          return <Heading key={index}>{renderInlineMarkdown(block.text)}</Heading>;
        }
        if (block.type === "list") {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "code") {
          return <pre key={index}><code>{block.text}</code></pre>;
        }
        return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; text: string }
  | { type: "paragraph"; text: string };

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.split(/\r?\n/);
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] = [];
  let inCode = false;

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length > 0) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCode) {
        blocks.push({ type: "code", text: code.join("\n") });
        code = [];
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      continue;
    }

    const listItem = /^[-*]\s+(?:\[[ xX]\]\s*)?(.+)$/.exec(trimmed);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1].trim());
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  if (code.length > 0) blocks.push({ type: "code", text: code.join("\n") });
  return blocks.length > 0 ? blocks : [{ type: "paragraph", text: "No content yet." }];
}
