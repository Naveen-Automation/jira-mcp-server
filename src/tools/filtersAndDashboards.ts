import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";

export function registerFilterAndDashboardTools(server: McpServer): void {
    server.tool(
        "listJiraFilters",
        "Search saved filters visible to the current user, returning IDs and JQL.",
        {
            filterName: z.string().optional(),
            accountId: z.string().optional().describe("Filter by owner"),
            startAt: z.number().optional(),
            maxResults: z.number().optional()
        },
        { title: "List Jira Filters", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", "/filter/search", {
                query: {
                    filterName: params.filterName,
                    accountId: params.accountId,
                    startAt: params.startAt,
                    maxResults: params.maxResults
                }
            });
            return toToolResult(res);
        })
    );

    server.tool(
        "listJiraDashboards",
        "Dashboards visible to the current user, for discovery and linking workflows.",
        {
            dashboardName: z.string().optional(),
            startAt: z.number().optional(),
            maxResults: z.number().optional()
        },
        { title: "List Jira Dashboards", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", "/dashboard/search", {
                query: { dashboardName: params.dashboardName, startAt: params.startAt, maxResults: params.maxResults }
            });
            return toToolResult(res);
        })
    );
}
