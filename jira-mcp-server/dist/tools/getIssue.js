import { z } from "zod";
import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";
import { fetchIssue, getJiraBaseUrl } from "../services/jiraClient.js";
import { adfToText } from "../utils/adfParser.js";
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
function parseIssueData(data, issueKey) {
    const record = data;
    const fields = (record.fields ?? {});
    let description = adfToText(fields.description);
    if (description.length > CHARACTER_LIMIT) {
        description =
            description.slice(0, CHARACTER_LIMIT) + "\n...(description truncated)";
    }
    const components = fields.components ?? [];
    const assignee = fields.assignee;
    const reporter = fields.reporter;
    const issuetype = fields.issuetype;
    const status = fields.status;
    const priority = fields.priority;
    return {
        key: issueKey,
        summary: fields.summary ?? "",
        description,
        labels: fields.labels ?? [],
        components: components.map((c) => c.name ?? ""),
        issue_type: issuetype?.name ?? "",
        status: status?.name ?? "",
        priority: priority?.name ?? "",
        assignee: assignee?.displayName ?? "Unassigned",
        reporter: reporter?.displayName ?? "Unknown",
        created: fields.created ?? "",
        updated: fields.updated ?? "",
        url: `${getJiraBaseUrl()}/browse/${issueKey}`,
        attachments: (fields.attachment ?? []).map((a) => {
            const attAuthor = a.author;
            return {
                id: a.id ?? "",
                filename: a.filename ?? "",
                mimeType: a.mimeType ?? "",
                size: a.size ?? 0,
                created: a.created ?? "",
                author: attAuthor?.displayName ?? "Unknown",
                content: a.content ?? "",
            };
        }),
        linked_issues: (fields.issuelinks ?? []).flatMap((link) => {
            const linkType = link.type;
            const inward = link.inwardIssue;
            const outward = link.outwardIssue;
            const results = [];
            if (inward) {
                const inwardStatus = inward.status;
                results.push({
                    id: link.id ?? "",
                    relationship: linkType?.inward ?? linkType?.name ?? "related",
                    linked_issue_key: inward.key ?? "",
                    linked_issue_summary: inward.summary ?? "",
                    linked_issue_status: inwardStatus?.name ?? "",
                });
            }
            if (outward) {
                const outwardStatus = outward.status;
                results.push({
                    id: link.id ?? "",
                    relationship: linkType?.outward ?? linkType?.name ?? "related",
                    linked_issue_key: outward.key ?? "",
                    linked_issue_summary: outward.summary ?? "",
                    linked_issue_status: outwardStatus?.name ?? "",
                });
            }
            return results;
        }),
    };
}
function filterFields(issue, includeFields) {
    if (!includeFields || includeFields.length === 0) {
        return issue;
    }
    const filtered = {};
    for (const field of includeFields) {
        if (field in issue) {
            filtered[field] = issue[field];
        }
    }
    return filtered;
}
function formatMarkdown(issue) {
    const components = issue.components.length > 0 ? issue.components.join(", ") : "None";
    const labels = issue.labels.length > 0 ? issue.labels.join(", ") : "None";
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
            ...issue.linked_issues.map((l) => `- **${l.relationship}**: ${l.linked_issue_key} — ${l.linked_issue_summary} [${l.linked_issue_status}]`),
            "",
        ] : []),
        "## Description",
        issue.description || "_No description provided._",
        "",
        "---",
        `🔗 ${issue.url}`,
    ].join("\n");
}
export function registerGetIssueTool(server) {
    server.registerTool("jira_get_issue", {
        description: "Fetch a JIRA issue by key. Returns issue details including summary, description (ADF parsed to plain text), status, priority, assignee, and more.",
        inputSchema: inputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async (params) => {
        const data = await fetchIssue(params.issue_key);
        const issue = parseIssueData(data, params.issue_key);
        const result = filterFields(issue, params.include_fields);
        const text = params.response_format === ResponseFormat.MARKDOWN
            ? formatMarkdown(issue)
            : JSON.stringify(result, null, 2);
        return {
            content: [{ type: "text", text }],
        };
    });
}
//# sourceMappingURL=getIssue.js.map