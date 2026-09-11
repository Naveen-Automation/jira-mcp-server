import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { textToAdf } from "../utilities/adf.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";

export function registerWorklogTools(server: McpServer): void {
    server.tool(
        "listJiraIssueWorklogs",
        "Paginated worklogs (logged time) for a Jira work item.",
        {
            issueIdOrKey: z.string(),
            startAt: z.number().optional(),
            maxResults: z.number().optional(),
            startedAfter: z.number().optional().describe("Epoch millis"),
            startedBefore: z.number().optional().describe("Epoch millis")
        },
        { title: "List Jira Issue Worklogs", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", `/issue/${encodeURIComponent(params.issueIdOrKey)}/worklog`, {
                query: {
                    startAt: params.startAt,
                    maxResults: params.maxResults,
                    startedAfter: params.startedAfter,
                    startedBefore: params.startedBefore
                }
            });
            return toToolResult(res);
        })
    );

    server.tool(
        "addOrEditJiraIssueWorklog",
        "Log time on an work item, or edit an existing worklog.",
        {
            issueIdOrKey: z.string(),
            worklogId: z.string().optional().describe("Provide to edit an existing worklog instead of creating one"),
            timeSpent: z.string().optional().describe("Jira duration format, e.g. '2h 30m' (alternative to timeSpentSeconds)"),
            timeSpentSeconds: z.number().optional(),
            started: z.string().optional().describe("ISO-8601 timestamp, e.g. 2025-01-15T09:00:00.000+0000. Defaults to now"),
            comment: z.string().optional().describe("Plain text worklog comment"),
            adjustEstimate: z.enum(["new", "leave", "manual", "auto"]).optional(),
            newEstimate: z.string().optional(),
            reduceBy: z.string().optional()
        },
        { title: "Add Or Edit Jira Issue Worklog", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        safeHandler(async (params: any) => {
            if (!params.timeSpent && !params.timeSpentSeconds) {
                throw new Error("Provide either timeSpent or timeSpentSeconds");
            }
            const payload: Record<string, unknown> = {
                ...(params.timeSpent ? { timeSpent: params.timeSpent } : {}),
                ...(params.timeSpentSeconds ? { timeSpentSeconds: params.timeSpentSeconds } : {}),
                ...(params.started ? { started: params.started } : {}),
                ...(params.comment ? { comment: textToAdf(params.comment) } : {})
            };
            const path = `/issue/${encodeURIComponent(params.issueIdOrKey)}/worklog${params.worklogId ? `/${params.worklogId}` : ""}`;
            const res = await jiraRequest(params.worklogId ? "PUT" : "POST", path, {
                query: { adjustEstimate: params.adjustEstimate, newEstimate: params.newEstimate, reduceBy: params.reduceBy },
                body: payload
            });
            return toToolResult(res, params.worklogId ? "Worklog updated" : "Worklog added");
        })
    );
}
