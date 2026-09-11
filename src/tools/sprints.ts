import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";

export function registerSprintTools(server: McpServer): void {
    server.tool(
        "listJiraBoardSprints",
        "Sprints from a board, optionally filtered to active, future, or closed.",
        {
            boardId: z.number(),
            state: z.enum(["active", "future", "closed"]).optional(),
            startAt: z.number().optional(),
            maxResults: z.number().optional()
        },
        { title: "List Jira Board Sprints", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", `/board/${params.boardId}/sprint`, {
                family: "agile",
                query: { state: params.state, startAt: params.startAt, maxResults: params.maxResults }
            });
            return toToolResult(res);
        })
    );

    server.tool(
        "getJiraBoardSprintData",
        "Resolve a board plus its sprint data in one call; defaults to the active sprint.",
        {
            boardId: z.number(),
            sprintId: z.number().optional().describe("Defaults to the board's active sprint"),
            includeIssues: z.boolean().optional()
        },
        { title: "Get Jira Board Sprint Data", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            let sprintId = params.sprintId;
            if (!sprintId) {
                const activeSprints = await jiraRequest<{ values: Array<{ id: number }> }>("GET", `/board/${params.boardId}/sprint`, {
                    family: "agile",
                    query: { state: "active" }
                });
                if (!activeSprints.ok) return toToolResult(activeSprints);
                const values = (activeSprints.body as { values: Array<{ id: number }> } | null)?.values ?? [];
                if (values.length === 0) {
                    throw new Error(`Board ${params.boardId} has no active sprint; pass sprintId explicitly`);
                }
                sprintId = values[0].id;
            }

            const sprintRes = await jiraRequest("GET", `/sprint/${sprintId}`, { family: "agile" });
            if (!params.includeIssues) return toToolResult(sprintRes);

            const issuesRes = await jiraRequest("GET", `/sprint/${sprintId}/issue`, { family: "agile" });
            const combined = { sprint: sprintRes.body, issues: issuesRes.body };
            const ok = sprintRes.ok && issuesRes.ok;
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `${ok ? "Success" : "Jira API error"} (sprint status ${sprintRes.status}, issues status ${issuesRes.status})\n${JSON.stringify(combined, null, 2)}`
                    }
                ],
                isError: !ok
            };
        })
    );

    server.tool(
        "manageJiraSprint",
        "Create, populate, start, update, or close a sprint.",
        {
            operation: z.enum(["create", "start", "close", "update", "addIssues"]),
            sprintId: z.number().optional().describe("Required for start/close/update/addIssues"),
            originBoardId: z.number().optional().describe("Required for create"),
            name: z.string().optional(),
            goal: z.string().optional(),
            startDate: z.string().optional().describe("ISO-8601, required for start"),
            endDate: z.string().optional().describe("ISO-8601, required for start"),
            issueKeys: z.array(z.string()).optional().describe("Required for addIssues")
        },
        { title: "Manage Jira Sprint", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        safeHandler(async (params: any) => {
            if (params.operation === "create") {
                if (!params.originBoardId || !params.name) {
                    throw new Error("originBoardId and name are required to create a sprint");
                }
                const res = await jiraRequest("POST", "/sprint", {
                    family: "agile",
                    body: { originBoardId: params.originBoardId, name: params.name, goal: params.goal }
                });
                return toToolResult(res, "Sprint created");
            }

            if (!params.sprintId) {
                throw new Error(`sprintId is required for operation '${params.operation}'`);
            }

            if (params.operation === "addIssues") {
                if (!params.issueKeys || params.issueKeys.length === 0) {
                    throw new Error("issueKeys is required for operation 'addIssues'");
                }
                const res = await jiraRequest("POST", `/sprint/${params.sprintId}/issue`, {
                    family: "agile",
                    body: { issues: params.issueKeys }
                });
                return toToolResult(res, "Issues added to sprint");
            }

            const body: Record<string, unknown> =
                params.operation === "start"
                    ? { state: "active", startDate: params.startDate, endDate: params.endDate, name: params.name, goal: params.goal }
                    : params.operation === "close"
                      ? { state: "closed" }
                      : { name: params.name, goal: params.goal, startDate: params.startDate, endDate: params.endDate };

            const res = await jiraRequest("PUT", `/sprint/${params.sprintId}`, { family: "agile", body });
            return toToolResult(res, `Sprint ${params.operation}d`);
        })
    );
}
