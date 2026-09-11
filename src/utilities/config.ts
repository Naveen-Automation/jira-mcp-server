export interface JiraConfig {
    baseUrl: string;
    email: string;
    apiToken: string;
    enableDelete: boolean;
    enableManage: boolean;
}

function requiredEnv(name: string): string {
    const value = process.env[name];
    if (!value || value.trim().length === 0) {
        throw new Error(
            `Missing required environment variable: ${name}. Set it in your MCP client config (see README).`
        );
    }
    return value;
}

let cachedConfig: JiraConfig | undefined;

/**
 * Loads and validates Jira connection settings from environment variables.
 * Cached after first successful load since these values don't change at runtime.
 */
export function loadConfig(): JiraConfig {
    if (cachedConfig) {
        return cachedConfig;
    }

    const baseUrl = requiredEnv("JIRA_URL").replace(/\/+$/, "");
    const email = requiredEnv("JIRA_USERNAME");
    const apiToken = requiredEnv("JIRA_TOKEN");

    cachedConfig = {
        baseUrl,
        email,
        apiToken,
        enableDelete: process.env.JIRA_ENABLE_DELETE === "true",
        enableManage: process.env.JIRA_ENABLE_MANAGE === "true"
    };
    return cachedConfig;
}
