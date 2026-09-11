import { loadConfig } from "./config.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
export type JiraApiFamily = "core" | "agile";

export interface JiraResponse<T = unknown> {
    status: number;
    ok: boolean;
    body: T | string | null;
}

export interface JiraRequestOptions {
    /** Query string parameters. Arrays are joined with commas; undefined/null values are skipped. */
    query?: Record<string, unknown>;
    /** JSON request body. Omit for requests without a body. */
    body?: unknown;
    /** Which Jira API family to hit. Defaults to the core REST API (v3). */
    family?: JiraApiFamily;
}

function authHeader(): string {
    const { email, apiToken } = loadConfig();
    return `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
}

function apiBase(family: JiraApiFamily): string {
    const { baseUrl } = loadConfig();
    return family === "agile" ? `${baseUrl}/rest/agile/1.0` : `${baseUrl}/rest/api/3`;
}

/**
 * Builds a URL query string from a plain object. Skips undefined/null values so callers
 * can pass optional params straight through without manual filtering. Arrays are serialized
 * as comma-separated values, matching how most Jira list endpoints accept multi-value params.
 */
export function buildQueryString(params?: Record<string, unknown>): string {
    if (!params) return "";
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
            if (value.length === 0) continue;
            searchParams.append(key, value.join(","));
        } else {
            searchParams.append(key, String(value));
        }
    }
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : "";
}

/**
 * Parses a fetch Response by content-type instead of assuming JSON, so a 204 No Content,
 * a plain-text error page, or an empty body never throws inside the caller.
 */
async function parseResponseBody<T>(response: Response): Promise<T | string | null> {
    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    if (text.length === 0) return null;

    if (contentType.includes("application/json")) {
        try {
            return JSON.parse(text) as T;
        } catch {
            return text;
        }
    }
    return text;
}

/**
 * Single shared entry point for every Jira REST/Agile call. Always returns the real HTTP
 * status code and parsed body -- including on non-2xx responses -- so tool handlers can
 * report the actual failure instead of a synthetic status.
 */
export async function jiraRequest<T = unknown>(
    method: HttpMethod,
    path: string,
    options: JiraRequestOptions = {}
): Promise<JiraResponse<T>> {
    const { query, body, family = "core" } = options;
    const url = `${apiBase(family)}${path}${buildQueryString(query)}`;

    const headers: Record<string, string> = {
        Authorization: authHeader(),
        Accept: "application/json"
    };
    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const parsedBody = await parseResponseBody<T>(response);
    return { status: response.status, ok: response.ok, body: parsedBody };
}

/**
 * Uploads a file to an issue as an attachment (multipart/form-data). Kept separate from
 * jiraRequest because Jira requires the X-Atlassian-Token header and a browser/undici-managed
 * multipart boundary rather than a JSON body.
 */
export async function jiraUploadAttachment(
    issueIdOrKey: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType?: string
): Promise<JiraResponse> {
    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType || "application/octet-stream" });
    form.append("file", blob, fileName);

    const response = await fetch(`${apiBase("core")}/issue/${encodeURIComponent(issueIdOrKey)}/attachments`, {
        method: "POST",
        headers: {
            Authorization: authHeader(),
            Accept: "application/json",
            "X-Atlassian-Token": "no-check"
        },
        body: form
    });

    const parsedBody = await parseResponseBody(response);
    return { status: response.status, ok: response.ok, body: parsedBody };
}

export interface JiraBinaryResponse {
    status: number;
    ok: boolean;
    buffer: Buffer | null;
    contentType: string | null;
    fileName: string | null;
}

/**
 * Downloads binary content (e.g. an attachment) from a Jira-authenticated URL, following
 * redirects to Jira's short-lived media storage URLs.
 */
export async function jiraDownloadBinary(urlOrPath: string): Promise<JiraBinaryResponse> {
    const url = urlOrPath.startsWith("http") ? urlOrPath : `${apiBase("core")}${urlOrPath}`;
    const response = await fetch(url, {
        headers: { Authorization: authHeader() },
        redirect: "follow"
    });

    if (!response.ok) {
        return { status: response.status, ok: false, buffer: null, contentType: null, fileName: null };
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type");
    const disposition = response.headers.get("content-disposition");
    const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/);

    return {
        status: response.status,
        ok: true,
        buffer: Buffer.from(arrayBuffer),
        contentType,
        fileName: match?.[1] ? decodeURIComponent(match[1]) : null
    };
}
