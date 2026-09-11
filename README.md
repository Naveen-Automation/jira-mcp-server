# Jira MCP Server

A Model Context Protocol (MCP) server for **Jira Cloud**. It exposes issue, project, board,
sprint, search, comment, worklog, link, version, attachment and property operations as MCP
tools, backed directly by the Jira Cloud REST API (v3) and Agile API (1.0).

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Configuration](#configuration)
- [Tool catalogue](#tool-catalogue)
- [Design notes](#design-notes)
- [Troubleshooting](#troubleshooting)

## Overview

- **Auth**: Jira Cloud API token (email + token, Basic Auth) — no OAuth redirect flow needed.
- **HTTP client**: Node's native `fetch`/`FormData` — no extra HTTP dependency.
- **Runtime deps**: just `@modelcontextprotocol/sdk` and `zod`.
- **Destructive/admin tools are off by default**: `deleteJiraIssue`, `deleteJiraComment`,
  `deleteJiraIssueAttachment`, `createJiraProject`, `updateJiraProject` only register when you
  explicitly opt in via env vars (see below).

## Prerequisites

- **Node.js** v20 or higher (native `fetch`/`FormData` need to be stable).
- **A Jira Cloud site** and an **API token** — create one at
  https://id.atlassian.com/manage-profile/security/api-tokens.
- An MCP-compatible client (VS Code + GitHub Copilot, Claude Code, etc.).

## Setup

1. Clone/copy this project, then install dependencies:
   ```bash
   npm install
   npm run build
   ```
2. Or, once published, install as a dependency of your own project:
   ```bash
  npm i @automate-io/jira-mcp-server@latest
   ```

## Configuration

The server reads its Jira connection from environment variables — set these in your MCP
client's server config, never commit them to source control.

| Variable | Required | Description |
| --- | --- | --- |
| `JIRA_URL` | Yes | Your site, e.g. `https://your-domain.atlassian.net` |
| `JIRA_USERNAME` | Yes | Account email used to generate the API token |
| `JIRA_TOKEN` | Yes | API token from id.atlassian.com |
| `JIRA_ENABLE_DELETE` | No | Set to `true` to register `deleteJiraIssue`/`deleteJiraComment`/`deleteJiraIssueAttachment` |
| `JIRA_ENABLE_MANAGE` | No | Set to `true` to register `createJiraProject`/`updateJiraProject` |

Example `.vscode/mcp.json` (also included in this repo, using prompted inputs so the token
isn't hardcoded):

```json
{
  "servers": {
    "jira-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["node_modules/@automate-io/jira-mcp-server/dist/server.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "JIRA_URL": "${input:jiraBaseUrl}",
        "JIRA_USERNAME": "${input:jiraEmail}",
        "JIRA_TOKEN": "${input:jiraApiToken}"
      }
    }
  },
  "inputs": [
    { "id": "jiraBaseUrl", "type": "promptString", "description": "Jira Cloud site URL" },
    { "id": "jiraEmail", "type": "promptString", "description": "Jira account email" },
    { "id": "jiraApiToken", "type": "promptString", "description": "Jira API token", "password": true }
  ]
}
```

## Tool catalogue

Grouped by file under `src/tools/`. 41 tools by default, 46 with delete/manage enabled.

| File | Tools |
| --- | --- |
| `issues.ts` | getJiraIssue, createJiraIssue, editJiraIssue, listJiraIssueTransitions, transitionJiraIssue, listJiraIssueChangelogs, watchJiraIssue, *deleteJiraIssue* |
| `comments.ts` | listJiraIssueComments, addOrEditJiraIssueComment, *deleteJiraComment* |
| `worklogs.ts` | listJiraIssueWorklogs, addOrEditJiraIssueWorklog |
| `links.ts` | listJiraIssueLinkTypes, createJiraIssueLink, listJiraIssueRemoteIssueLinks |
| `search.ts` | searchJiraIssuesUsingJql |
| `users.ts` | getJiraCurrentUser, getJiraUser, lookupJiraAccountId, findJiraIssueAssignableUsers |
| `projects.ts` | listJiraProjects, listJiraProjectIssueTypesMetadata, getJiraIssueTypeMetaWithFields, listJiraStatuses, listJiraProjectComponents, *createJiraProject*, *updateJiraProject* |
| `versions.ts` | getJiraProjectVersions, manageJiraProjectVersion, getJiraProjectVersionRelatedWork, manageJiraProjectVersionRelatedWork |
| `boards.ts` | listJiraBoards, getJiraBoardConfig, getJiraBoardIssueData, createJiraBoard |
| `sprints.ts` | listJiraBoardSprints, getJiraBoardSprintData, manageJiraSprint |
| `filtersAndDashboards.ts` | listJiraFilters, listJiraDashboards |
| `properties.ts` | getJiraEntityProperty, editJiraEntityProperty |
| `attachments.ts` | uploadAttachmentToJiraIssue, downloadJiraIssueAttachment, *deleteJiraIssueAttachment* |

*Italicised tools* require the matching `JIRA_ENABLE_*` flag.

## Design notes

- `src/utilities/jira-client.ts` is the single HTTP entry point (`jiraRequest`). It preserves
  the real HTTP status code on every response (including errors), parses the body by
  content-type instead of assuming JSON, and needs no manual context disposal since it's built
  on native `fetch`.
- `src/utilities/tool-helpers.ts` provides `safeHandler` (shared try/catch) and `toToolResult`
  (maps a Jira response to MCP content with `isError` reflecting the real status), so each tool
  handler stays a few lines of Jira-specific logic instead of repeating boilerplate.
- `src/utilities/adf.ts` converts plain text into the minimal Atlassian Document Format Jira
  Cloud's v3 API requires for rich-text fields (comments, descriptions, worklog comments).
- `searchJiraIssuesUsingJql` uses the current token-paginated `/rest/api/3/search/jql`
  endpoint, since the older `startAt`-based `/rest/api/3/search` is deprecated.
- Startup logs go to **stderr**, never stdout — stdout is reserved for the MCP JSON-RPC
  stream over the stdio transport, so anything else written there would corrupt it.

## Troubleshooting

- **Server exits immediately with "Missing required environment variable"**: set
  `JIRA_URL`, `JIRA_USERNAME`, `JIRA_TOKEN` in your MCP client's server config.
- **401/403 from Jira**: regenerate your API token, and confirm `JIRA_USERNAME` matches the
  Atlassian account that owns the token.
- **A delete/manage tool doesn't show up**: set `JIRA_ENABLE_DELETE` / `JIRA_ENABLE_MANAGE`
  to `"true"` in the server's `env` config.
