import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";

export function registerUserTools(server: McpServer): void {
    server.tool(
        "getJiraCurrentUser",
        "Details for the current Jira user.",
        {},
        { title: "Get Jira Current User", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async () => {
            const res = await jiraRequest("GET", "/myself");
            return toToolResult(res);
        })
    );

    server.tool(
        "getJiraUser",
        "Retrieves a Jira user's profile by account ID.",
        { accountId: z.string() },
        { title: "Get Jira User", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", "/user", { query: { accountId: params.accountId } });
            return toToolResult(res);
        })
    );

    server.tool(
        "lookupJiraAccountId",
        "Look up a Jira user account ID by display name or email.",
        {
            query: z.string().describe("Display name or email to search for"),
            maxResults: z.number().optional()
        },
        { title: "Lookup Jira Account Id", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", "/user/search", { query: { query: params.query, maxResults: params.maxResults } });
            return toToolResult(res);
        })
    );

    server.tool(
        "findJiraIssueAssignableUsers",
        "Find users assignable to a Jira space or work item.",
        {
            projectKey: z.string().optional(),
            issueIdOrKey: z.string().optional(),
            query: z.string().optional().describe("Filter by display name or email"),
            maxResults: z.number().optional()
        },
        { title: "Find Jira Issue Assignable Users", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            if (!params.projectKey && !params.issueIdOrKey) {
                throw new Error("Provide either projectKey or issueIdOrKey");
            }
            const res = await jiraRequest("GET", "/user/assignable/search", {
                query: {
                    project: params.projectKey,
                    issueKey: params.issueIdOrKey,
                    query: params.query,
                    maxResults: params.maxResults
                }
            });
            return toToolResult(res);
        })
    );
}
