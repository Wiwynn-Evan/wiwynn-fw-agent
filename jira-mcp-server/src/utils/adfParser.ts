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
