import { useState } from "react";

// Minimal markdown renderer for pathway_nodes.body.
// Supports: paragraphs, **bold**, *italic*, ordered/unordered lists,
// > blockquotes, and ```copy fenced blocks rendered with a copy button.
function CopyBlock({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-block">
      <pre>{text}</pre>
      <button
        type="button"
        className="copy-btn"
        onClick={() => {
          navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

function inline(text, key) {
  const parts = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined) parts.push(<strong key={`${key}-b${i++}`}>{m[1]}</strong>);
    else parts.push(<em key={`${key}-i${i++}`}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function NodeBody({ markdown }) {
  if (!markdown) return null;

  const blocks = [];
  const segments = markdown.split(/```(\w*)\n([\s\S]*?)```/g);
  // split yields: text, lang, code, text, lang, code, ...
  for (let s = 0; s < segments.length; s += 3) {
    const text = segments[s];
    if (text && text.trim()) blocks.push({ type: "text", content: text.trim() });
    if (s + 2 < segments.length) {
      blocks.push({ type: "code", lang: segments[s + 1], content: segments[s + 2].replace(/\n$/, "") });
    }
  }

  const out = [];
  blocks.forEach((block, bi) => {
    if (block.type === "code") {
      out.push(<CopyBlock key={`c${bi}`} text={block.content} />);
      return;
    }
    // group text lines into paragraphs / lists / quotes
    const lines = block.content.split("\n");
    let list = null;
    let listType = null;
    const flush = () => {
      if (list) {
        out.push(
          listType === "ol" ? (
            <ol key={`l${out.length}`}>{list}</ol>
          ) : (
            <ul key={`l${out.length}`}>{list}</ul>
          )
        );
        list = null;
        listType = null;
      }
    };
    lines.forEach((raw, li) => {
      const line = raw.trim();
      const key = `${bi}-${li}`;
      if (!line) {
        flush();
        return;
      }
      const olMatch = line.match(/^\d+\.\s+(.*)$/);
      if (olMatch) {
        if (listType !== "ol") flush();
        listType = "ol";
        list = list ?? [];
        list.push(<li key={key}>{inline(olMatch[1], key)}</li>);
        return;
      }
      if (line.startsWith("- ")) {
        if (listType !== "ul") flush();
        listType = "ul";
        list = list ?? [];
        list.push(<li key={key}>{inline(line.slice(2), key)}</li>);
        return;
      }
      flush();
      if (line.startsWith("> ")) {
        out.push(
          <blockquote key={key}>{inline(line.slice(2), key)}</blockquote>
        );
        return;
      }
      out.push(<p key={key}>{inline(line, key)}</p>);
    });
    flush();
  });

  return <div className="node-body">{out}</div>;
}
