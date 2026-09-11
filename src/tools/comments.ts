import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { textToAdf } from "../utilities/adf.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";
import { loadConfig } from "../utilities/config.js";

export function registerCommentTools(server: McpServer): void {
    server.tool(
        "listJiraIssueComments",
        "Paginated comments for a Jira work item.",
        {
            issueIdOrKey: z.string(),
            startAt: z.number().optional(),
            maxResults: z.number().optional(),
            orderBy: z.string().optional().describe("e.g. created, -created"),
            expand: z.array(z.string()).optional()
        },
        { title: "List Jira Issue Comments", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", `/issue/${encodeURIComponent(params.issueIdOrKey)}/comment`, {
                query: { startAt: params.startAt, maxResults: params.maxResults, orderBy: params.orderBy, expand: params.expand }
            });
            return toToolResult(res);
        })
    );

    server.tool(
        "addOrEditJiraIssueComment",
        "Add a comment, or edit an existing one.",
        {
            issueIdOrKey: z.string(),
            commentId: z.string().optional().describe("Provide to edit an existing comment instead of creating one"),
            body: z.string().describe("Plain text comment body, converted to Atlassian Document Format"),
            visibilityType: z.enum(["group", "role"]).optional(),
            visibilityValue: z.string().optional().describe("Group name or role name, required if visibilityType is set")
        },
        { title: "Add Or Edit Jira Issue Comment", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        safeHandler(async (params: any) => {
            const payload: Record<string, unknown> = { body: textToAdf(params.body) };
            if (params.visibilityType && params.visibilityValue) {
                payload.visibility = { type: params.visibilityType, value: params.visibilityValue };
            }
            const path = `/issue/${encodeURIComponent(params.issueIdOrKey)}/comment${params.commentId ? `/${params.commentId}` : ""}`;
            const res = await jiraRequest(params.commentId ? "PUT" : "POST", path, { body: payload });
            return toToolResult(res, params.commentId ? "Comment updated" : "Comment added");
        })
    );

    const config = loadConfig();
    if (config.enableDelete) {
        server.tool(
            "deleteJiraComment",
            "Permanently delete a comment from an issue. Cannot be undone.",
            { issueIdOrKey: z.string(), commentId: z.string() },
            { title: "Delete Jira Comment", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
            safeHandler(async (params: any) => {
                const res = await jiraRequest(
                    "DELETE",
                    `/issue/${encodeURIComponent(params.issueIdOrKey)}/comment/${encodeURIComponent(params.commentId)}`
                );
                return toToolResult(res, "Comment deleted");
            })
        );
    }
}
