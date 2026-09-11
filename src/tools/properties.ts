import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";

const entityTypeSchema = z.enum(["issue", "comment", "worklog", "dashboardItem", "user"]);

/**
 * Entity properties live under different REST paths depending on the entity type.
 * Worklog properties are nested under their parent issue; dashboard item properties
 * are nested under their parent dashboard; user properties are keyed by accountId
 * via a query param instead of a path segment.
 */
function buildPropertyPath(params: any, propertyKey?: string): string {
    const suffix = propertyKey ? `/properties/${encodeURIComponent(propertyKey)}` : "/properties";
    switch (params.entityType) {
        case "issue":
            return `/issue/${encodeURIComponent(params.entityId)}${suffix}`;
        case "comment":
            return `/comment/${encodeURIComponent(params.entityId)}${suffix}`;
        case "worklog":
            if (!params.issueIdOrKey) throw new Error("issueIdOrKey is required when entityType is 'worklog'");
            return `/issue/${encodeURIComponent(params.issueIdOrKey)}/worklog/${encodeURIComponent(params.entityId)}${suffix}`;
        case "dashboardItem":
            if (!params.dashboardId) throw new Error("dashboardId is required when entityType is 'dashboardItem'");
            return `/dashboard/${encodeURIComponent(params.dashboardId)}/items/${encodeURIComponent(params.entityId)}${suffix}`;
        case "user":
            return `/user${suffix}`;
        default:
            throw new Error(`Unsupported entityType: ${params.entityType}`);
    }
}

export function registerPropertyTools(server: McpServer): void {
    server.tool(
        "getJiraEntityProperty",
        "Read a property from the key/value store on an work item, comment, worklog, dashboard item, or user.",
        {
            entityType: entityTypeSchema,
            entityId: z.string().optional().describe("Required for all entity types except 'user'"),
            propertyKey: z.string(),
            issueIdOrKey: z.string().optional().describe("Required when entityType is 'worklog'"),
            dashboardId: z.string().optional().describe("Required when entityType is 'dashboardItem'"),
            accountId: z.string().optional().describe("Used when entityType is 'user'; defaults to the current user")
        },
        { title: "Get Jira Entity Property", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const path = buildPropertyPath(params, params.propertyKey);
            const res = await jiraRequest("GET", path, params.entityType === "user" ? { query: { accountId: params.accountId } } : {});
            return toToolResult(res);
        })
    );

    server.tool(
        "editJiraEntityProperty",
        "Set a property in the key/value store on an work item, comment, worklog, dashboard item, or user.",
        {
            entityType: entityTypeSchema,
            entityId: z.string().optional().describe("Required for all entity types except 'user'"),
            propertyKey: z.string(),
            value: z.any().describe("JSON value to store"),
            issueIdOrKey: z.string().optional().describe("Required when entityType is 'worklog'"),
            dashboardId: z.string().optional().describe("Required when entityType is 'dashboardItem'"),
            accountId: z.string().optional().describe("Used when entityType is 'user'; defaults to the current user")
        },
        { title: "Edit Jira Entity Property", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const path = buildPropertyPath(params, params.propertyKey);
            const res = await jiraRequest("PUT", path, {
                query: params.entityType === "user" ? { accountId: params.accountId } : undefined,
                body: params.value
            });
            return toToolResult(res, "Property set");
        })
    );
}
