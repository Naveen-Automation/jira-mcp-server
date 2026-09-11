/**
 * Wraps plain text in a minimal Atlassian Document Format (ADF) document, which
 * Jira Cloud's v3 API requires for rich-text fields like comments, descriptions
 * and worklog comments. Multiple lines become separate paragraphs.
 */
export function textToAdf(text: string): Record<string, unknown> {
    const paragraphs = text.split("\n").map((line) => ({
        type: "paragraph",
        content: line.length > 0 ? [{ type: "text", text: line }] : []
    }));

    return {
        type: "doc",
        version: 1,
        content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph", content: [] }]
    };
}
