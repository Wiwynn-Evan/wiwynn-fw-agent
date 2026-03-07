import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGetIssueTool } from "./tools/getIssue.js";
import { registerSearchIssuesTool } from "./tools/searchIssues.js";
import { registerGetCommentsTool } from "./tools/getComments.js";
function validateEnv() {
    const required = ["JIRA_URL", "JIRA_USERNAME", "JIRA_API_TOKEN"];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}. ` +
            `Copy .env.example to .env and fill in your JIRA credentials.`);
    }
}
async function main() {
    validateEnv();
    const server = new McpServer({
        name: "jira-mcp-server",
        version: "1.0.0",
    });
    registerGetIssueTool(server);
    registerSearchIssuesTool(server);
    registerGetCommentsTool(server);
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("jira-mcp-server started (stdio transport)");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map