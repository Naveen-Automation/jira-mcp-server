import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraRequest } from "../utilities/jira-client.js";
import { safeHandler, toToolResult } from "../utilities/tool-helpers.js";

export function registerBoardTools(server: McpServer): void {
    server.tool(
        "listJiraBoards",
        "Lists boards visible to the current user.",
        {
            projectKeyOrId: z.string().optional(),
            type: z.enum(["scrum", "kanban"]).optional(),
            name: z.string().optional(),
            startAt: z.number().optional(),
            maxResults: z.number().optional()
        },
        { title: "List Jira Boards", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", "/board", {
                family: "agile",
                query: {
                    projectKeyOrId: params.projectKeyOrId,
                    type: params.type,
                    name: params.name,
                    startAt: params.startAt,
                    maxResults: params.maxResults
                }
            });
            return toToolResult(res);
        })
    );

    server.tool(
        "getJiraBoardConfig",
        "A board's configuration: filter, column layout, and each column's mapped statuses.",
        { boardId: z.number() },
        { title: "Get Jira Board Config", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("GET", `/board/${params.boardId}/configuration`, { family: "agile" });
            return toToolResult(res);
        })
    );

    server.tool(
        "getJiraBoardIssueData",
        "The work items on a board, its backlog, or both, with optional count and JQL filtering.",
        {
            boardId: z.number(),
            source: z.enum(["board", "backlog", "both"]).optional().describe("Defaults to 'board'"),
            jql: z.string().optional(),
            startAt: z.number().optional(),
            maxResults: z.number().optional(),
            fields: z.array(z.string()).optional()
        },
        { title: "Get Jira Board Issue Data", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any) => {
            const query = { jql: params.jql, startAt: params.startAt, maxResults: params.maxResults, fields: params.fields };
            const source = params.source ?? "board";

            if (source === "board") {
                const res = await jiraRequest("GET", `/board/${params.boardId}/issue`, { family: "agile", query });
                return toToolResult(res);
            }
            if (source === "backlog") {
                const res = await jiraRequest("GET", `/board/${params.boardId}/backlog`, { family: "agile", query });
                return toToolResult(res);
            }

            const [boardRes, backlogRes] = await Promise.all([
                jiraRequest("GET", `/board/${params.boardId}/issue`, { family: "agile", query }),
                jiraRequest("GET", `/board/${params.boardId}/backlog`, { family: "agile", query })
            ]);
            const combined = { board: boardRes.body, backlog: backlogRes.body };
            const ok = boardRes.ok && backlogRes.ok;
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `${ok ? "Success" : "Jira API error"} (board status ${boardRes.status}, backlog status ${backlogRes.status})\n${JSON.stringify(combined, null, 2)}`
                    }
                ],
                isError: !ok
            };
        })
    );

    server.tool(
        "createJiraBoard",
        "Create a company-managed board (scrum or kanban) from an existing filter.",
        {
            name: z.string(),
            type: z.enum(["scrum", "kanban"]),
            filterId: z.number(),
            projectKeyOrId: z.string().optional().describe("Location to create the board under")
        },
        { title: "Create Jira Board", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        safeHandler(async (params: any) => {
            const res = await jiraRequest("POST", "/board", {
                family: "agile",
                body: {
                    name: params.name,
                    type: params.type,
                    filterId: params.filterId,
                    ...(params.projectKeyOrId ? { location: { type: "project", projectKeyOrId: params.projectKeyOrId } } : {})
                }
            });
            return toToolResult(res, "Board created");
        })
    );
}
