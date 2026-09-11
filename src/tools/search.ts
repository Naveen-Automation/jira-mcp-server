import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";

export function registerSearchTools(server: McpServer): void {
    server.tool(
        "searchJiraIssuesUsingJql",
        "Search Jira work items using JQL.",
        {
            jql: z.string().describe("JQL query, e.g. 'project = PROJ AND status = \"In Progress\" ORDER BY updated DESC'"),
            maxResults: z.number().optional().describe("Defaults to 50"),
            fields: z.array(z.string()).optional().describe("Limit the response to these field IDs/names"),
            expand: z.array(z.string()).optional(),
            nextPageToken: z.string().optional().describe("Token from a previous response's nextPageToken, to fetch the next page")
        },
        { title: "Search Jira Issues Using JQL", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            // Uses the current /rest/api/3/search/jql endpoint (token-based pagination);
            // the older startAt-based /rest/api/3/search endpoint is deprecated/removed.
            const res = await jiraRequest("POST", "/search/jql", {
                body: {
                    jql: params.jql,
                    maxResults: params.maxResults,
                    fields: params.fields,
                    expand: params.expand,
                    nextPageToken: params.nextPageToken
                }
            });
            return toToolResult(res);
        })
    );
}
