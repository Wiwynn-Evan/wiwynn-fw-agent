import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResponseFormat } from "../constants.js";
import { searchIssues, getJiraBaseUrl } from "../services/jiraClient.js";

const inputSchema = z.object({
  jql: z
    .string()
    .describe('JQL query string, e.g. "project = GC20T5T7 AND status = Open"'),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Maximum number of results (1-50, default 20)"),
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

type SearchIssuesInput = z.infer<typeof inputSchema>;

interface IssueSummary {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  url: string;
}

interface SearchResponse {
  issues: IssueSummary[];
  total: number;
  startAt: number;
  maxResults: number;
  has_more: boolean;
  next_start_at: number | null;
}

function parseSearchResult(data: unknown): SearchResponse {
  const record = data as Record<string, unknown>;
  const rawIssues = (record.issues ?? []) as Array<Record<string, unknown>>;
  const total = (record.total as number) ?? 0;
  const startAt = (record.startAt as number) ?? 0;
  const maxResults = (record.maxResults as number) ?? 0;
  const baseUrl = getJiraBaseUrl();

  const issues: IssueSummary[] = rawIssues.map((raw) => {
    const fields = (raw.fields ?? {}) as Record<string, unknown>;
    const assignee = fields.assignee as Record<string, unknown> | null;
    const status = fields.status as Record<string, unknown> | null;
    const key = (raw.key as string) ?? "";

    return {
      key,
      summary: (fields.summary as string) ?? "",
      status: (status?.name as string) ?? "",
      assignee: (assignee?.displayName as string) ?? "Unassigned",
      url: `${baseUrl}/browse/${key}`,
    };
  });

  const hasMore = startAt + issues.length < total;

  return {
    issues,
    total,
    startAt,
    maxResults,
    has_more: hasMore,
    next_start_at: hasMore ? startAt + issues.length : null,
  };
}

function formatMarkdown(result: SearchResponse, jql: string): string {
  const lines: string[] = [
    `# JIRA Search Results`,
    "",
    `**JQL**: \`${jql}\``,
    `**Showing**: ${result.startAt + 1}–${result.startAt + result.issues.length} of ${result.total}`,
    "",
  ];

  if (result.issues.length === 0) {
    lines.push("_No issues found._");
  } else {
    lines.push("| # | Key | Summary | Status | Assignee |");
    lines.push("|---|-----|---------|--------|----------|");

    result.issues.forEach((issue, idx) => {
      const num = result.startAt + idx + 1;
      lines.push(
        `| ${num} | [${issue.key}](${issue.url}) | ${issue.summary} | ${issue.status} | ${issue.assignee} |`
      );
    });
  }

  if (result.has_more) {
    lines.push(
      "",
      `_More results available. Use \`start_at: ${result.next_start_at}\` to fetch the next page._`
    );
  }

  return lines.join("\n");
}

export function registerSearchIssuesTool(server: McpServer): void {
  server.registerTool(
    "jira_search_issues",
    {
      description:
        "Search JIRA issues using JQL (JIRA Query Language). Returns a paginated list of matching issues with key, summary, status, and assignee.",
      inputSchema: inputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: SearchIssuesInput) => {
      const data = await searchIssues(
        params.jql,
        params.start_at,
        params.max_results
      );
      const result = parseSearchResult(data);

      const text =
        params.response_format === ResponseFormat.MARKDOWN
          ? formatMarkdown(result, params.jql)
          : JSON.stringify(result, null, 2);

      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );
}
