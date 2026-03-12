import type { AdfNode } from "../types.js";

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "rule",
]);

function isAdfNode(value: unknown): value is AdfNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as Record<string, unknown>).type === "string"
  );
}

function parseNode(node: AdfNode): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  // Media nodes have no text/content children — emit a placeholder so
  // the caller knows an image or file attachment exists here.
  if (node.type === "media") {
    const mediaType = (node.attrs?.type as string) ?? "file";
    const filename = (node.attrs?.alt as string) ?? (node.attrs?.id as string) ?? "unknown";
    if (mediaType === "external") {
      const url = (node.attrs?.url as string) ?? "unknown";
      return `[外部圖片: ${url}]\n`;
    }
    return `[附件${mediaType === "image" ? "圖片" : "檔案"}: ${filename}]\n`;
  }

  // mediaSingle / mediaGroup are wrapper nodes — recurse into children
  // but also add a trailing newline so the placeholder stands on its own line.
  if (node.type === "mediaSingle" || node.type === "mediaGroup") {
    const children = node.content ?? [];
    return children.map((child) => parseNode(child)).join("") + "\n";
  }

  const children = node.content ?? [];
  const text = children.map((child) => parseNode(child)).join("");

  if (BLOCK_TYPES.has(node.type)) {
    return text + "\n";
  }

  return text;
}

export function adfToText(node: unknown): string {
  if (node == null) {
    return "";
  }
  if (typeof node === "string") {
    return node;
  }
  if (isAdfNode(node)) {
    return parseNode(node).trim();
  }
  return String(node);
}
