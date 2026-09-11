import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";

export function registerLinkTools(server: McpServer): void {
    server.tool(
        "listJiraIssueLinkTypes",
        "Available work item link types in Jira.",
        {},
        { title: "List Jira Issue Link Types", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async () => {
            const res = await jiraRequest("GET", "/issueLinkType");
            return toToolResult(res);
        })
    );

    server.tool(
        "createJiraIssueLink",
        "Create a link between two Jira work items.",
        {
            linkTypeName: z.string().describe("Link type name from listJiraIssueLinkTypes, e.g. 'Blocks', 'Relates'"),
            inwardIssueKey: z.string(),
            outwardIssueKey: z.string(),
            comment: z.string().optional().describe("Plain text comment to attach to the link")
        },
        { title: "Create Jira Issue Link", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("POST", "/issueLink", {
                body: {
                    type: { name: params.linkTypeName },
                    inwardIssue: { key: params.inwardIssueKey },
                    outwardIssue: { key: params.outwardIssueKey },
                    ...(params.comment ? { comment: { body: params.comment } } : {})
                }
            });
            return toToolResult(res, "Issue link created");
        })
    );

    server.tool(
        "listJiraIssueRemoteIssueLinks",
        "Remote links associated with a Jira work item.",
        { issueIdOrKey: z.string() },
        { title: "List Jira Issue Remote Links", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", `/issue/${encodeURIComponent(params.issueIdOrKey)}/remotelink`);
            return toToolResult(res);
        })
    );
}
