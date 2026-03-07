import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { fetchComments } from "../services/jiraClient.js";
import { adfToText } from "../utils/adfParser.js";
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
function parseCommentsData(data) {
    const record = data;
    const rawComments = (record.comments ?? []);
    const total = record.total ?? 0;
    const startAt = record.startAt ?? 0;
    const maxResults = record.maxResults ?? 0;
    const comments = rawComments.map((raw) => {
        const author = raw.author;
        return {
            id: raw.id ?? "",
            author: author?.displayName ?? "Unknown",
            body: adfToText(raw.body),
            created: raw.created ?? "",
            updated: raw.updated ?? "",
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
function formatMarkdown(result, issueKey) {
    const lines = [
        `# Comments for ${issueKey}`,
        "",
        `**Total**: ${result.total} comments | **Showing**: ${result.startAt + 1}–${result.startAt + result.comments.length}`,
        "",
    ];
    if (result.comments.length === 0) {
        lines.push("_No comments found._");
    }
    else {
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
        lines.push(`_More comments available. Use \`start_at: ${result.next_start_at}\` to fetch the next page._`);
    }
    return lines.join("\n");
}
export function registerGetCommentsTool(server) {
    server.registerTool("jira_get_issue_comments", {
        description: "Fetch comments for a JIRA issue. Returns paginated comments with author, date, and body (ADF parsed to plain text).",
        inputSchema: inputSchema.shape,
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async (params) => {
        const data = await fetchComments(params.issue_key, params.start_at, params.max_results);
        const result = parseCommentsData(data);
        const text = params.response_format === ResponseFormat.MARKDOWN
            ? formatMarkdown(result, params.issue_key)
            : JSON.stringify(result, null, 2);
        return {
            content: [{ type: "text", text }],
        };
    });
}
//# sourceMappingURL=getComments.js.map