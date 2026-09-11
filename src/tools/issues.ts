import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { textToAdf } from "../utilities/adf.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";
import { loadConfig } from "../utilities/config.js";

export function registerIssueTools(server: McpServer): void {
    server.tool(
        "getJiraIssue",
        "Get a Jira work item by ID or key.",
        {
            issueIdOrKey: z.string().describe("Issue ID or key, e.g. PROJ-123"),
            fields: z.array(z.string()).optional().describe("Limit the response to these field IDs/names"),
            expand: z.array(z.string()).optional().describe("e.g. renderedFields, names, schema, changelog"),
            properties: z.array(z.string()).optional()
        },
        { title: "Get Jira Issue", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", `/issue/${encodeURIComponent(params.issueIdOrKey)}`, {
                query: { fields: params.fields, expand: params.expand, properties: params.properties }
            });
            return toToolResult(res);
        })
    );

    server.tool(
        "createJiraIssue",
        "Create a new Jira work item.",
        {
            projectKey: z.string().describe("Key of the project to create the issue in, e.g. PROJ"),
            issueTypeName: z.string().optional().describe("Issue type name, e.g. Task, Bug, Story"),
            issueTypeId: z.string().optional().describe("Issue type ID (alternative to issueTypeName)"),
            summary: z.string(),
            description: z.string().optional().describe("Plain text description, converted to Atlassian Document Format"),
            fields: z.object({}).passthrough().optional().describe("Additional/override fields, e.g. assignee, priority, labels, custom fields"),
            update: z.object({}).passthrough().optional()
        },
        { title: "Create Jira Issue", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        safeHandler(async (params: any) => {
            if (!params.issueTypeName && !params.issueTypeId) {
                throw new Error("Provide either issueTypeName or issueTypeId");
            }
            const fields: Record<string, unknown> = {
                project: { key: params.projectKey },
                issuetype: params.issueTypeId ? { id: params.issueTypeId } : { name: params.issueTypeName },
                summary: params.summary,
                ...(params.description ? { description: textToAdf(params.description) } : {}),
                ...(params.fields ?? {})
            };
            const res = await jiraRequest("POST", "/issue", { body: { fields, update: params.update } });
            return toToolResult(res, "Issue created");
        })
    );

    server.tool(
        "editJiraIssue",
        "Edit an existing work item; only fields editable on that work item can be set.",
        {
            issueIdOrKey: z.string(),
            fields: z.object({}).passthrough().optional(),
            update: z.object({}).passthrough().optional(),
            notifyUsers: z.boolean().optional()
        },
        { title: "Edit Jira Issue", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            if (!params.fields && !params.update) {
                throw new Error("Provide at least one of fields or update");
            }
            const res = await jiraRequest("PUT", `/issue/${encodeURIComponent(params.issueIdOrKey)}`, {
                query: { notifyUsers: params.notifyUsers },
                body: { fields: params.fields, update: params.update }
            });
            return toToolResult(res, "Issue updated");
        })
    );

    server.tool(
        "listJiraIssueTransitions",
        "Available workflow transitions for a Jira work item.",
        { issueIdOrKey: z.string() },
        { title: "List Jira Issue Transitions", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", `/issue/${encodeURIComponent(params.issueIdOrKey)}/transitions`);
            return toToolResult(res);
        })
    );

    server.tool(
        "transitionJiraIssue",
        "Transition an work item to a new status, and/or assign it to a sprint or backlog.",
        {
            issueIdOrKey: z.string(),
            transitionId: z.string().describe("Transition ID from listJiraIssueTransitions"),
            comment: z.string().optional().describe("Plain text comment to add as part of the transition"),
            fields: z.object({}).passthrough().optional().describe("e.g. { resolution: { name: \"Done\" } }")
        },
        { title: "Transition Jira Issue", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        safeHandler(async (params: any) => {
            const update: Record<string, unknown> = {};
            if (params.comment) {
                update.comment = [{ add: { body: textToAdf(params.comment) } }];
            }
            const res = await jiraRequest("POST", `/issue/${encodeURIComponent(params.issueIdOrKey)}/transitions`, {
                body: {
                    transition: { id: params.transitionId },
                    fields: params.fields,
                    ...(Object.keys(update).length > 0 ? { update } : {})
                }
            });
            return toToolResult(res, "Issue transitioned");
        })
    );

    server.tool(
        "listJiraIssueChangelogs",
        "An work item's field-change history, paginated oldest-first.",
        {
            issueIdOrKey: z.string(),
            startAt: z.number().optional(),
            maxResults: z.number().optional()
        },
        { title: "List Jira Issue Changelogs", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", `/issue/${encodeURIComponent(params.issueIdOrKey)}/changelog`, {
                query: { startAt: params.startAt, maxResults: params.maxResults }
            });
            return toToolResult(res);
        })
    );

    server.tool(
        "watchJiraIssue",
        "Watch or unwatch a work item.",
        {
            issueIdOrKey: z.string(),
            watch: z.boolean().describe("true to watch, false to unwatch"),
            accountId: z.string().optional().describe("Defaults to the current authenticated user")
        },
        { title: "Watch Jira Issue", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const path = `/issue/${encodeURIComponent(params.issueIdOrKey)}/watchers`;
            const res = params.watch
                ? await jiraRequest("POST", path, { body: params.accountId ?? null })
                : await jiraRequest("DELETE", path, { query: { accountId: params.accountId } });
            return toToolResult(res, params.watch ? "Now watching issue" : "Stopped watching issue");
        })
    );

    const config = loadConfig();
    if (config.enableDelete) {
        server.tool(
            "deleteJiraIssue",
            "Permanently delete an issue. Cannot be undone.",
            {
                issueIdOrKey: z.string(),
                deleteSubtasks: z.boolean().optional()
            },
            { title: "Delete Jira Issue", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
            safeHandler(async (params: any) => {
                const res = await jiraRequest("DELETE", `/issue/${encodeURIComponent(params.issueIdOrKey)}`, {
                    query: { deleteSubtasks: params.deleteSubtasks }
                });
                return toToolResult(res, "Issue deleted");
            })
        );
    }
}
