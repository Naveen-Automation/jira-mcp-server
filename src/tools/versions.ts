import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";

export function registerVersionTools(server: McpServer): void {
    server.tool(
        "getJiraProjectVersions",
        "A space's releases/versions, or a single version.",
        {
            projectIdOrKey: z.string().optional().describe("List all versions for this project"),
            versionId: z.string().optional().describe("Get a single version by ID instead"),
            startAt: z.number().optional(),
            maxResults: z.number().optional()
        },
        { title: "Get Jira Project Versions", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            if (!params.projectIdOrKey && !params.versionId) {
                throw new Error("Provide either projectIdOrKey or versionId");
            }
            const res = params.versionId
                ? await jiraRequest("GET", `/version/${encodeURIComponent(params.versionId)}`)
                : await jiraRequest("GET", `/project/${encodeURIComponent(params.projectIdOrKey)}/version`, {
                      query: { startAt: params.startAt, maxResults: params.maxResults }
                  });
            return toToolResult(res);
        })
    );

    server.tool(
        "manageJiraProjectVersion",
        "Create, update, release, or archive a space version (release or fix version).",
        {
            operation: z.enum(["create", "update", "release", "archive"]),
            versionId: z.string().optional().describe("Required for update/release/archive"),
            projectIdOrKey: z.string().optional().describe("Required for create"),
            name: z.string().optional().describe("Required for create"),
            description: z.string().optional(),
            startDate: z.string().optional().describe("YYYY-MM-DD"),
            releaseDate: z.string().optional().describe("YYYY-MM-DD")
        },
        { title: "Manage Jira Project Version", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        safeHandler(async (params: any) => {
            if (params.operation === "create") {
                if (!params.projectIdOrKey || !params.name) {
                    throw new Error("projectIdOrKey and name are required to create a version");
                }
                const res = await jiraRequest("POST", "/version", {
                    body: {
                        project: params.projectIdOrKey,
                        name: params.name,
                        description: params.description,
                        startDate: params.startDate,
                        releaseDate: params.releaseDate
                    }
                });
                return toToolResult(res, "Version created");
            }

            if (!params.versionId) {
                throw new Error(`versionId is required for operation '${params.operation}'`);
            }

            const body: Record<string, unknown> =
                params.operation === "release"
                    ? { released: true }
                    : params.operation === "archive"
                      ? { archived: true }
                      : {
                            name: params.name,
                            description: params.description,
                            startDate: params.startDate,
                            releaseDate: params.releaseDate
                        };

            const res = await jiraRequest("PUT", `/version/${encodeURIComponent(params.versionId)}`, { body });
            return toToolResult(res, `Version ${params.operation}d`);
        })
    );

    server.tool(
        "getJiraProjectVersionRelatedWork",
        "Related work links (evidence) on a space version (release).",
        { versionId: z.string() },
        { title: "Get Jira Project Version Related Work", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", `/version/${encodeURIComponent(params.versionId)}/relatedwork`);
            return toToolResult(res);
        })
    );

    server.tool(
        "manageJiraProjectVersionRelatedWork",
        "Create or update related work links on a space version.",
        {
            versionId: z.string(),
            relatedWorkId: z.string().optional().describe("Provide to update an existing related work link instead of creating one"),
            category: z.string().describe("e.g. 'Design', 'Development'"),
            title: z.string(),
            url: z.string()
        },
        { title: "Manage Jira Project Version Related Work", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        safeHandler(async (params: any) => {
            const path = `/version/${encodeURIComponent(params.versionId)}/relatedwork${params.relatedWorkId ? `/${params.relatedWorkId}` : ""}`;
            const res = await jiraRequest(params.relatedWorkId ? "PUT" : "POST", path, {
                body: { category: params.category, title: params.title, url: params.url }
            });
            return toToolResult(res, params.relatedWorkId ? "Related work updated" : "Related work created");
        })
    );
}
