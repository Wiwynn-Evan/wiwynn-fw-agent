import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResponseFormat } from "../constants.js";
import { fetchComments } from "../services/jiraClient.js";
import { adfToText } from "../utils/adfParser.js";
import type { JiraComment } from "../types.js";

const inputSchema = z.object({
  issue_key: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/)
    .describe("JIRA issue key, e.g. GC20T5T7-121"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of comments (1-50, default 10)"),
  start_at: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Start index for pagination (default 0)"),
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Response format: markdown or json"),
});

type GetCommentsInput = z.infer<typeof inputSchema>;

interface CommentsResponse {
  comments: JiraComment[];
  total: number;
  startAt: number;
  maxResults: number;
  has_more: boolean;
  next_start_at: number | null;
}

function parseCommentsData(data: unknown): CommentsResponse {
  const record = data as Record<string, unknown>;
  const rawComments = (record.comments ?? []) as Array<
    Record<string, unknown>
  >;
  const total = (record.total as number) ?? 0;
  const startAt = (record.startAt as number) ?? 0;
  const maxResults = (record.maxResults as number) ?? 0;

  const comments: JiraComment[] = rawComments.map((raw) => {
    const author = raw.author as Record<string, unknown> | null;
    return {
      id: (raw.id as string) ?? "",
      author: (author?.displayName as string) ?? "Unknown",
      body: adfToText(raw.body),
      created: (raw.created as string) ?? "",
      updated: (raw.updated as string) ?? "",
    };
  });

  const hasMore = startAt + comments.length < total;

  return {
    comments,
    total,
    startAt,
    maxResults,
    has_more: hasMore,
    next_start_at: hasMore ? startAt + comments.length : null,
  };
}

function formatMarkdown(result: CommentsResponse, issueKey: string): string {
  const lines: string[] = [
    `# Comments for ${issueKey}`,
    "",
    `**Total**: ${result.total} comments | **Showing**: ${result.startAt + 1}–${result.startAt + result.comments.length}`,
    "",
  ];

  if (result.comments.length === 0) {
    lines.push("_No comments found._");
  } else {
    result.comments.forEach((comment, idx) => {
      const num = result.startAt + idx + 1;
      const date = comment.created.slice(0, 10);
      lines.push(`### Comment #${num} — ${comment.author} (${date})`);
      lines.push("");
      lines.push(comment.body || "_Empty comment_");
      lines.push("");
      lines.push("---");
      lines.push("");
    });
  }

  if (result.has_more) {
    lines.push(
      `_More comments available. Use \`start_at: ${result.next_start_at}\` to fetch the next page._`
    );
  }

  return lines.join("\n");
}

export function registerGetCommentsTool(server: McpServer): void {
  server.registerTool(
    "jira_get_issue_comments",
    {
      description:
        "Fetch comments for a JIRA issue. Returns paginated comments with author, date, and body (ADF parsed to plain text).",
      inputSchema: inputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetCommentsInput) => {
      const data = await fetchComments(
        params.issue_key,
        params.start_at,
        params.max_results
      );
      const result = parseCommentsData(data);

      const text =
        params.response_format === ResponseFormat.MARKDOWN
          ? formatMarkdown(result, params.issue_key)
          : JSON.stringify(result, null, 2);

      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );
}
