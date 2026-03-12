import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";
import { fetchIssue, getJiraBaseUrl } from "../services/jiraClient.js";
import { adfToText } from "../utils/adfParser.js";
import type { JiraIssue } from "../types.js";

const inputSchema = z.object({
  issue_key: z
    .string()
    .regex(/^[A-Z][A-Z0-9]+-\d+$/)
    .describe("JIRA issue key, e.g. GC20T5T7-121"),
  response_format: z
    .nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Response format: markdown or json"),
  include_fields: z
    .array(z.string())
    .optional()
    .describe("Optional subset of fields to return"),
});

type GetIssueInput = z.infer<typeof inputSchema>;

function parseIssueData(data: unknown, issueKey: string): JiraIssue {
  const record = data as Record<string, unknown>;
  const fields = (record.fields ?? {}) as Record<string, unknown>;

  let description = adfToText(fields.description);
  if (description.length > CHARACTER_LIMIT) {
    description =
      description.slice(0, CHARACTER_LIMIT) + "\n...(description truncated)";
  }

  const components = (fields.components as Array<Record<string, unknown>> | undefined) ?? [];
  const assignee = fields.assignee as Record<string, unknown> | null;
  const reporter = fields.reporter as Record<string, unknown> | null;
  const issuetype = fields.issuetype as Record<string, unknown> | null;
  const status = fields.status as Record<string, unknown> | null;
  const priority = fields.priority as Record<string, unknown> | null;

  return {
    key: issueKey,
    summary: (fields.summary as string) ?? "",
    description,
    labels: (fields.labels as string[]) ?? [],
    components: components.map((c) => (c.name as string) ?? ""),
    issue_type: (issuetype?.name as string) ?? "",
    status: (status?.name as string) ?? "",
    priority: (priority?.name as string) ?? "",
    assignee: (assignee?.displayName as string) ?? "Unassigned",
    reporter: (reporter?.displayName as string) ?? "Unknown",
    created: (fields.created as string) ?? "",
    updated: (fields.updated as string) ?? "",
    url: `${getJiraBaseUrl()}/browse/${issueKey}`,
    attachments: ((fields.attachment as Array<Record<string, unknown>> | undefined) ?? []).map((a) => {
      const attAuthor = a.author as Record<string, unknown> | null;
      return {
        id: (a.id as string) ?? "",
        filename: (a.filename as string) ?? "",
        mimeType: (a.mimeType as string) ?? "",
        size: (a.size as number) ?? 0,
        created: (a.created as string) ?? "",
        author: (attAuthor?.displayName as string) ?? "Unknown",
        content: (a.content as string) ?? "",
      };
    }),
    linked_issues: ((fields.issuelinks as Array<Record<string, unknown>> | undefined) ?? []).flatMap((link) => {
      const linkType = link.type as Record<string, unknown> | null;
      const inward = link.inwardIssue as Record<string, unknown> | null;
      const outward = link.outwardIssue as Record<string, unknown> | null;
      const results = [];
      if (inward) {
        const inwardStatus = inward.status as Record<string, unknown> | null;
        results.push({
          id: (link.id as string) ?? "",
          relationship: (linkType?.inward as string) ?? (linkType?.name as string) ?? "related",
          linked_issue_key: (inward.key as string) ?? "",
          linked_issue_summary: (inward.summary as string) ?? "",
          linked_issue_status: (inwardStatus?.name as string) ?? "",
        });
      }
      if (outward) {
        const outwardStatus = outward.status as Record<string, unknown> | null;
        results.push({
          id: (link.id as string) ?? "",
          relationship: (linkType?.outward as string) ?? (linkType?.name as string) ?? "related",
          linked_issue_key: (outward.key as string) ?? "",
          linked_issue_summary: (outward.summary as string) ?? "",
          linked_issue_status: (outwardStatus?.name as string) ?? "",
        });
      }
      return results;
    }),
  };
}

function filterFields(
  issue: JiraIssue,
  includeFields?: string[]
): Partial<JiraIssue> {
  if (!includeFields || includeFields.length === 0) {
    return issue;
  }
  const filtered: Record<string, unknown> = {};
  for (const field of includeFields) {
    if (field in issue) {
      filtered[field] = issue[field as keyof JiraIssue];
    }
  }
  return filtered as Partial<JiraIssue>;
}

function formatMarkdown(issue: JiraIssue): string {
  const components =
    issue.components.length > 0 ? issue.components.join(", ") : "None";
  const labels =
    issue.labels.length > 0 ? issue.labels.join(", ") : "None";
  const createdDate = issue.created.slice(0, 10);
  const updatedDate = issue.updated.slice(0, 10);

  return [
    `# [${issue.key}] ${issue.summary}`,
    "",
    `**Type**: ${issue.issue_type} | **Status**: ${issue.status} | **Priority**: ${issue.priority}`,
    `**Assignee**: ${issue.assignee} | **Reporter**: ${issue.reporter}`,
    `**Created**: ${createdDate} | **Updated**: ${updatedDate}`,
    "",
    `**Components**: ${components}`,
    `**Labels**: ${labels}`,
    "",
    // Attachments section
    ...(issue.attachments.length > 0 ? [
      "## Attachments",
      ...issue.attachments.map((a) => {
        const sizeKb = (a.size / 1024).toFixed(1);
        const date = a.created.slice(0, 10);
        return `- 📎 **${a.filename}** (${a.mimeType}, ${sizeKb} KB, uploaded by ${a.author} on ${date})`;
      }),
      "",
    ] : []),
    // Linked Issues section
    ...(issue.linked_issues.length > 0 ? [
      "## Linked Issues",
      ...issue.linked_issues.map((l) =>
        `- **${l.relationship}**: ${l.linked_issue_key} — ${l.linked_issue_summary} [${l.linked_issue_status}]`
      ),
      "",
    ] : []),
    "## Description",
    issue.description || "_No description provided._",
    "",
    "---",
    `🔗 ${issue.url}`,
  ].join("\n");
}

export function registerGetIssueTool(server: McpServer): void {
  server.registerTool(
    "jira_get_issue",
    {
      description:
        "Fetch a JIRA issue by key. Returns issue details including summary, description (ADF parsed to plain text), status, priority, assignee, and more.",
      inputSchema: inputSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetIssueInput) => {
      const data = await fetchIssue(params.issue_key);
      const issue = parseIssueData(data, params.issue_key);
      const result = filterFields(issue, params.include_fields);

      const text =
        params.response_format === ResponseFormat.MARKDOWN
          ? formatMarkdown(issue)
          : JSON.stringify(result, null, 2);

      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );
}
