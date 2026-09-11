import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import { jiraRequest, jiraUploadAttachment, jiraDownloadBinary } from "../utilities/jira-client.js";
import { safeHandler, toToolResult, errorResult, type ToolTextResult } from "../utilities/tool-helpers.js";
import { loadConfig } from "../utilities/config.js";

export function registerAttachmentTools(server: McpServer): void {
    server.tool(
        "uploadAttachmentToJiraIssue",
        "Attach a local file to an work item.",
        {
            issueIdOrKey: z.string(),
            filePath: z.string().describe("Absolute path to the local file, on the machine running this MCP server"),
            mimeType: z.string().optional()
        },
        { title: "Upload Attachment To Jira Issue", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        safeHandler(async (params: any) => {
            const fileBuffer = await fs.readFile(params.filePath);
            const fileName = path.basename(params.filePath);
            const res = await jiraUploadAttachment(params.issueIdOrKey, fileName, fileBuffer, params.mimeType);
            return toToolResult(res, "Attachment uploaded");
        })
    );

    server.tool(
        "downloadJiraIssueAttachment",
        "Get a short-lived download URL for an attachment and a local command to save the file.",
        {
            attachmentId: z.string(),
            savePath: z.string().optional().describe("If provided, downloads and writes the file to this local path instead of just returning a URL")
        },
        { title: "Download Jira Issue Attachment", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        safeHandler(async (params: any): Promise<ToolTextResult> => {
            const metaRes = await jiraRequest<{ filename: string; content: string; mimeType: string; size: number }>(
                "GET",
                `/attachment/${encodeURIComponent(params.attachmentId)}`
            );
            if (!metaRes.ok) return toToolResult(metaRes);
            const meta = metaRes.body as { filename: string; content: string; mimeType: string; size: number };

            if (!params.savePath) {
                const config = loadConfig();
                return {
                    content: [
                        {
                            type: "text",
                            text:
                                `Attachment: ${meta.filename} (${meta.mimeType}, ${meta.size} bytes)\n` +
                                `Content URL: ${meta.content}\n` +
                                `Download command (replace <api-token>):\n` +
                                `curl -u "${config.email}:<api-token>" -L -o "${meta.filename}" "${meta.content}"`
                        }
                    ]
                };
            }

            const binary = await jiraDownloadBinary(meta.content);
            if (!binary.ok || !binary.buffer) {
                return errorResult(new Error(`Failed to download attachment content (status ${binary.status})`));
            }
            await fs.writeFile(params.savePath, binary.buffer);
            return {
                content: [{ type: "text", text: `Saved ${meta.filename} (${binary.buffer.length} bytes) to ${params.savePath}` }]
            };
        })
    );

    const config = loadConfig();
    if (config.enableDelete) {
        server.tool(
            "deleteJiraIssueAttachment",
            "Permanently delete an attachment from an issue. Cannot be undone.",
            { attachmentId: z.string() },
            { title: "Delete Jira Issue Attachment", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
            safeHandler(async (params: any) => {
                const res = await jiraRequest("DELETE", `/attachment/${encodeURIComponent(params.attachmentId)}`);
                return toToolResult(res, "Attachment deleted");
            })
        );
    }
}
