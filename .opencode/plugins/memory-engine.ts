import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "fs"
import { join, relative } from "path"

// ============================================================
// Memory Engine Plugin for OpenCode
// Provides automated memory management + memory-search tool
// ============================================================

const MEMORY_DIR = ".opencode/memory"
const SESSIONS_DIR = `${MEMORY_DIR}/sessions`
const LONG_TERM_DIR = `${MEMORY_DIR}/long-term`
const CORRECTIONS_DIR = `${MEMORY_DIR}/corrections`
const REFLECTIONS_DIR = `${MEMORY_DIR}/reflections`
const INDEX_FILE = `${MEMORY_DIR}/index.md`
const ERROR_NOTEBOOK = `${CORRECTIONS_DIR}/error-notebook.md`

let messageCount = 0
const CHECKPOINT_INTERVAL = 20

// --- Helper Functions ---

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function getTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`
}

function getDateString(): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function readFileSafe(filepath: string): string {
  try {
    return readFileSync(filepath, "utf-8")
  } catch {
    return ""
  }
}

function getAllMemoryFiles(baseDir: string): string[] {
  const results: string[] = []

  function walk(dir: string) {
    if (!existsSync(dir)) return
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name.endsWith(".md")) {
        results.push(fullPath)
      }
    }
  }

  walk(baseDir)
  return results
}

function searchMemories(baseDir: string, query: string, category?: string): Array<{ file: string; matches: string[] }> {
  const results: Array<{ file: string; matches: string[] }> = []
  const queryLower = query.toLowerCase()

  let searchDir = baseDir
  if (category) {
    const categoryMap: Record<string, string> = {
      "long-term": join(baseDir, "long-term"),
      "corrections": join(baseDir, "corrections"),
      "sessions": join(baseDir, "sessions"),
      "reflections": join(baseDir, "reflections"),
    }
    searchDir = categoryMap[category] || baseDir
  }

  const files = getAllMemoryFiles(searchDir)

  for (const file of files) {
    const content = readFileSafe(file)
    if (!content) continue

    const lines = content.split("\n")
    const matchingLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(queryLower)) {
        // Include surrounding context (2 lines before and after)
        const start = Math.max(0, i - 2)
        const end = Math.min(lines.length - 1, i + 2)
        const context = lines.slice(start, end + 1).join("\n")
        matchingLines.push(`[Line ${i + 1}]\n${context}`)
      }
    }

    if (matchingLines.length > 0) {
      results.push({
        file: relative(baseDir, file),
        matches: matchingLines,
      })
    }
  }

  return results
}

function getRecentSessionLogs(sessionsDir: string, count: number = 3): string {
  if (!existsSync(sessionsDir)) return ""

  const files = readdirSync(sessionsDir)
    .filter(f => f.endsWith(".md"))
    .sort()
    .reverse()
    .slice(0, count)

  if (files.length === 0) return ""

  let content = "## Recent Session Logs\n\n"
  for (const file of files) {
    const filePath = join(sessionsDir, file)
    const fileContent = readFileSafe(filePath)
    if (fileContent) {
      content += `### ${file.replace(".md", "")}\n${fileContent}\n\n`
    }
  }

  return content
}

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0
  return readdirSync(dir).filter(f => f.endsWith(".md")).length
}

function updateIndex(baseDir: string): void {
  const longTermCount = countFiles(join(baseDir, "long-term"))
  const correctionsContent = readFileSafe(join(baseDir, "corrections", "error-notebook.md"))
  const errorCount = (correctionsContent.match(/^### /gm) || []).length
  const sessionCount = countFiles(join(baseDir, "sessions"))
  const reflectionCount = countFiles(join(baseDir, "reflections"))

  const index = `# Memory Index

> Last updated: ${getDateString()}

## 📁 Structure

- **long-term/** — 長期記憶（Debug 經驗、常用模式、重要決策）
- **corrections/** — 錯誤筆記本（記錄犯過的錯誤及修復方式）
- **sessions/** — Session 日誌（每次對話自動產生的摘要）
- **reflections/** — 反思報告（定期回顧的產出）

## 📊 Stats

- Long-term memories: ${longTermCount} files
- Error records: ${errorCount}
- Session logs: ${sessionCount}
- Reflections: ${reflectionCount}

## 🔗 Recent Sessions

${getRecentSessionLogs(join(baseDir, "sessions"), 3) || "_No sessions logged yet._"}
`

  writeFileSync(join(baseDir, "index.md"), index, "utf-8")
}

// --- Plugin Export ---

export const MemoryEngine: Plugin = async ({ project, client, $, directory, worktree }) => {
  const memoryBase = join(directory, MEMORY_DIR)

  // Ensure directories exist on plugin load
  ensureDir(join(directory, SESSIONS_DIR))
  ensureDir(join(directory, LONG_TERM_DIR))
  ensureDir(join(directory, CORRECTIONS_DIR))
  ensureDir(join(directory, REFLECTIONS_DIR))

  console.log("[Memory Engine] Plugin loaded for:", directory)

  return {
    // --- Event Handler ---
    event: async ({ event }) => {
      // Session Created → Load memory context
      if (event.type === "session.created") {
        console.log("[Memory Engine] Session created — loading memory context")

        try {
          const index = readFileSafe(join(memoryBase, "index.md"))
          const errorNotebook = readFileSafe(join(memoryBase, "corrections", "error-notebook.md"))
          const recentSessions = getRecentSessionLogs(join(memoryBase, "sessions"), 2)

          if (index || errorNotebook || recentSessions) {
            await client.app.log({
              body: {
                service: "memory-engine",
                level: "info",
                message: "Memory context loaded for new session",
                extra: {
                  hasIndex: !!index,
                  hasErrors: !!errorNotebook,
                  hasRecentSessions: !!recentSessions,
                },
              },
            })
          }
        } catch (e) {
          console.error("[Memory Engine] Error loading memory:", e)
        }
      }

      // Session Idle → Auto-save session summary
      if (event.type === "session.idle") {
        console.log("[Memory Engine] Session idle — saving session log")

        try {
          const timestamp = getTimestamp()
          const sessionFile = join(directory, SESSIONS_DIR, `${timestamp}.md`)
          const sessionContent = `# Session Log: ${timestamp}

> Auto-generated by Memory Engine on session idle

## Summary

_This session log was auto-created. Content will be populated when AI generates a summary._

## Timestamp

- Created: ${new Date().toISOString()}
`
          writeFileSync(sessionFile, sessionContent, "utf-8")
          updateIndex(memoryBase)

          await client.app.log({
            body: {
              service: "memory-engine",
              level: "info",
              message: `Session log saved: ${timestamp}.md`,
            },
          })
        } catch (e) {
          console.error("[Memory Engine] Error saving session log:", e)
        }
      }
    },

    // --- Compaction Hook ---
    "experimental.session.compacting": async (input, output) => {
      console.log("[Memory Engine] Session compacting — injecting memory context")

      try {
        const parts: string[] = []

        // Inject error notebook
        const errorNotebook = readFileSafe(join(memoryBase, "corrections", "error-notebook.md"))
        if (errorNotebook && errorNotebook.includes("### ")) {
          parts.push("## Active Error Records\n" + errorNotebook)
        }

        // Inject recent session context
        const recentSessions = getRecentSessionLogs(join(memoryBase, "sessions"), 1)
        if (recentSessions) {
          parts.push(recentSessions)
        }

        // Inject key long-term memories (decisions)
        const decisions = readFileSafe(join(memoryBase, "long-term", "decisions.md"))
        if (decisions && decisions.includes("## ")) {
          parts.push("## Key Decisions\n" + decisions)
        }

        if (parts.length > 0) {
          output.context.push(`## Memory Engine Context\n\nThe following memory context should be preserved across compaction:\n\n${parts.join("\n\n---\n\n")}`)
        }
      } catch (e) {
        console.error("[Memory Engine] Error injecting compaction context:", e)
      }
    },

    // --- Write Guard ---
    "tool.execute.before": async (input, output) => {
      // Protect core memory files from accidental overwrite
      if (input.tool === "write") {
        const filePath = output.args?.filePath || ""
        if (filePath.includes("/memory/index.md")) {
          // index.md is managed by the plugin — warn but don't block
          console.log("[Memory Engine] Warning: Direct write to index.md — index is auto-managed")
        }
      }
    },

    // --- Custom Tool: memory-search ---
    tool: {
      "memory-search": tool({
        description:
          "Search the memory store for relevant experiences, patterns, decisions, and error records. " +
          "Use this tool to find past knowledge before starting new work or when encountering familiar problems. " +
          "搜尋記憶庫中的相關經驗和知識。",
        args: {
          query: tool.schema.string({
            description: "Search query — keywords or phrases to look for in memory files",
          }),
          category: tool.schema.optional(
            tool.schema.enum(["long-term", "corrections", "sessions", "reflections"]),
            {
              description: "Optional: limit search to a specific memory category",
            }
          ),
        },
        async execute(args, context) {
          const results = searchMemories(memoryBase, args.query, args.category)

          if (results.length === 0) {
            return `No memories found matching "${args.query}"${args.category ? ` in category "${args.category}"` : ""}.`
          }

          let output = `## Memory Search Results for "${args.query}"\n\n`
          output += `Found matches in ${results.length} file(s):\n\n`

          for (const result of results) {
            output += `### 📄 ${result.file}\n\n`
            for (const match of result.matches.slice(0, 5)) {
              output += "```\n" + match + "\n```\n\n"
            }
            if (result.matches.length > 5) {
              output += `_...and ${result.matches.length - 5} more matches_\n\n`
            }
          }

          return output
        },
      }),
    },
  }
}
