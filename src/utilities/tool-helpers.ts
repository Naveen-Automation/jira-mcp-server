import type { JiraResponse } from "./jira-client.js";

export interface ToolTextResult {
    [key: string]: unknown;
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
}

/**
 * Renders a Jira API response as MCP tool output. Uses the response's own `ok` flag
 * (backed by the real HTTP status) to set isError, instead of assuming success whenever
 * no exception was thrown.
 */
export function toToolResult(response: JiraResponse, successLabel?: string): ToolTextResult {
    const bodyText = typeof response.body === "string" ? response.body : JSON.stringify(response.body, null, 2);
    const prefix = response.ok ? successLabel ?? "Success" : "Jira API error";
    return {
        content: [{ type: "text", text: `${prefix} (status ${response.status})\n${bodyText}` }],
        isError: !response.ok
    };
}

export function errorResult(error: unknown): ToolTextResult {
    return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true
    };
}

/**
 * Wraps a tool handler so every registration doesn't need its own try/catch. Network
 * errors, thrown validation errors, etc. all become a single consistent isError result.
 */
export function safeHandler<TArgs extends Record<string, unknown>>(
    handler: (args: TArgs) => Promise<ToolTextResult>
): (args: TArgs) => Promise<ToolTextResult> {
    return async (args: TArgs) => {
        try {
            return await handler(args);
        } catch (error) {
            return errorResult(error);
        }
    };
}
