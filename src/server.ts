#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./utilities/config.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerWorklogTools } from "./tools/worklogs.js";
import { registerLinkTools } from "./tools/links.js";
import { registerSearchTools } from "./tools/search.js";
import { registerUserTools } from "./tools/users.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerVersionTools } from "./tools/versions.js";
import { registerBoardTools } from "./tools/boards.js";
import { registerSprintTools } from "./tools/sprints.js";
import { registerFilterAndDashboardTools } from "./tools/filtersAndDashboards.js";
import { registerPropertyTools } from "./tools/properties.js";
import { registerAttachmentTools } from "./tools/attachments.js";

const server = new McpServer({
    name: "Jira MCP Server",
    version: "0.0.1",
    capabilities: {
        resources: {},
        tools: {},
        prompts: {}
    }
});

function registerAllTools(): void {
    registerIssueTools(server);
    registerCommentTools(server);
    registerWorklogTools(server);
    registerLinkTools(server);
    registerSearchTools(server);
    registerUserTools(server);
    registerProjectTools(server);
    registerVersionTools(server);
    registerBoardTools(server);
    registerSprintTools(server);
    registerFilterAndDashboardTools(server);
    registerPropertyTools(server);
    registerAttachmentTools(server);
}

async function main(): Promise<void> {
    // Fail fast with a clear message if JIRA_URL / JIRA_USERNAME / JIRA_TOKEN are missing,
    // rather than only failing once the first tool is invoked.
    loadConfig();
    registerAllTools();

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Jira MCP Server is running...");
}

main().catch((error) => {
    console.error("Failed to start Jira MCP Server:", error instanceof Error ? error.message : error);
    process.exit(1);
});
