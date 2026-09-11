import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";
import { loadConfig } from "../utilities/config.js";

export function registerProjectTools(server: McpServer): void {
    server.tool(
        "listJiraProjects",
        "Get Jira spaces visible to the current user.",
        {
            query: z.string().optional().describe("Filter by project name or key"),
            startAt: z.number().optional(),
            maxResults: z.number().optional()
        },
        { title: "List Jira Projects", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", "/project/search", {
                query: { query: params.query, startAt: params.startAt, maxResults: params.maxResults }
            });
            return toToolResult(res);
        })
    );

    server.tool(
        "listJiraProjectIssueTypesMetadata",
        "All work item types available in a Jira space.",
        { projectIdOrKey: z.string() },
        { title: "List Jira Project Issue Types Metadata", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", `/issue/createmeta/${encodeURIComponent(params.projectIdOrKey)}/issuetypes`);
            return toToolResult(res);
        })
    );

    server.tool(
        "getJiraIssueTypeMetaWithFields",
        "Schema and field metadata for a specific work item type in a project, for creating work items with correct fields.",
        { projectIdOrKey: z.string(), issueTypeId: z.string() },
        { title: "Get Jira Issue Type Meta With Fields", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest(
                "GET",
                `/issue/createmeta/${encodeURIComponent(params.projectIdOrKey)}/issuetypes/${encodeURIComponent(params.issueTypeId)}`
            );
            return toToolResult(res);
        })
    );

    server.tool(
        "listJiraStatuses",
        "List of statuses a Jira work item can be in.",
        { projectIdOrKey: z.string().optional().describe("Scope to a single project's workflow statuses") },
        { title: "List Jira Statuses", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = params.projectIdOrKey
                ? await jiraRequest("GET", `/project/${encodeURIComponent(params.projectIdOrKey)}/statuses`)
                : await jiraRequest("GET", "/status");
            return toToolResult(res);
        })
    );

    server.tool(
        "listJiraProjectComponents",
        "Components in a space, with IDs, names, work item counts, and ownership details.",
        { projectIdOrKey: z.string() },
        { title: "List Jira Project Components", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", `/project/${encodeURIComponent(params.projectIdOrKey)}/component`);
            return toToolResult(res);
        })
    );

    const config = loadConfig();
    if (config.enableManage) {
        server.tool(
            "createJiraProject",
            "Create a new Jira space from a space template.",
            {
                key: z.string().describe("Project key, e.g. PROJ"),
                name: z.string(),
                projectTypeKey: z.string().describe("e.g. software, business, service_desk"),
                leadAccountId: z.string(),
                description: z.string().optional(),
                projectTemplateKey: z.string().optional().describe("e.g. com.pyxis.greenhopper.jira:gh-simplified-agility-kanban")
            },
            { title: "Create Jira Project", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
            safeHandler(async (params: any) => {
                const res = await jiraRequest("POST", "/project", {
                    body: {
                        key: params.key,
                        name: params.name,
                        projectTypeKey: params.projectTypeKey,
                        leadAccountId: params.leadAccountId,
                        description: params.description,
                        projectTemplateKey: params.projectTemplateKey
                    }
                });
                return toToolResult(res, "Project created");
            })
        );

        server.tool(
            "updateJiraProject",
            "Update settings on an existing space.",
            {
                projectIdOrKey: z.string(),
                name: z.string().optional(),
                description: z.string().optional(),
                leadAccountId: z.string().optional(),
                fields: z.object({}).passthrough().optional().describe("Additional/override project fields")
            },
            { title: "Update Jira Project", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
            safeHandler(async (params: any) => {
                const res = await jiraRequest("PUT", `/project/${encodeURIComponent(params.projectIdOrKey)}`, {
                    body: {
                        name: params.name,
                        description: params.description,
                        leadAccountId: params.leadAccountId,
                        ...(params.fields ?? {})
                    }
                });
                return toToolResult(res, "Project updated");
            })
        );
    }
}
