/**
 * Export functionality for conversation traces
 */

import { marked } from 'marked';
import type { SearchableCluster } from '../data/types';

// Re-export for consumers that import from here
export type { SearchableCluster };

// Configure marked for safe rendering
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
});

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render markdown to HTML
 */
export function renderMarkdown(text: string): string {
  if (!text) return '';
  try {
    return marked.parse(text) as string;
  } catch {
    // Fallback to escaped text if parsing fails
    return escapeHtml(text);
  }
}

/**
 * Get a safe filename from the conversation title
 */
export function getSafeFilename(title: string): string {
  return (
    title
      .replace(/[^a-z0-9\s-]/gi, '')
      .replace(/\s+/g, '-')
      .substring(0, 50)
      .toLowerCase() || 'conversation'
  );
}

/**
 * Trigger a file download
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * CSS styles for HTML export
 */
const HTML_EXPORT_STYLES = `
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
    }
    h1 { border-bottom: 2px solid #ddd; padding-bottom: 10px; }
    .turn { margin-bottom: 30px; background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .user { background: #e3f2fd; padding: 15px; border-radius: 6px; margin-bottom: 15px; }
    .user-label { font-weight: 600; color: #1565c0; margin-bottom: 5px; }
    .assistant { }
    .thinking { background: #fff3e0; padding: 15px; border-radius: 6px; margin-bottom: 10px; }
    .thinking-header { font-weight: 600; color: #e65100; margin-bottom: 5px; cursor: pointer; }
    .thinking-content { white-space: pre-wrap; font-size: 14px; color: #666; }
    .tool { background: #f3e5f5; padding: 15px; border-radius: 6px; margin-bottom: 10px; }
    .tool-header { font-weight: 600; color: #7b1fa2; margin-bottom: 5px; }
    .tool-content { white-space: pre-wrap; font-size: 13px; font-family: monospace; background: rgba(0,0,0,0.05); padding: 10px; border-radius: 4px; overflow-x: auto; }
    .tool-result { background: #e8f5e9; }
    .tool-result .tool-header { color: #2e7d32; }
    .tool-error { background: #ffebee; }
    .tool-error .tool-header { color: #c62828; }
    .text { }
    .meta { color: #666; font-size: 12px; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }
    /* Markdown content */
    .user > div:last-child, .text, .thinking-content { line-height: 1.6; }
    .user > div:last-child p, .text p { margin: 0 0 0.75em 0; }
    .user > div:last-child p:last-child, .text p:last-child { margin-bottom: 0; }
    code { background: rgba(0,0,0,0.08); padding: 0.15em 0.4em; border-radius: 3px; font-family: monospace; font-size: 0.9em; }
    pre { background: rgba(0,0,0,0.08); padding: 12px; border-radius: 6px; overflow-x: auto; margin: 0.75em 0; }
    pre code { background: none; padding: 0; }
    blockquote { margin: 0.75em 0; padding: 0.5em 1em; border-left: 3px solid #ddd; background: rgba(0,0,0,0.03); }
    ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
    table { border-collapse: collapse; margin: 0.75em 0; }
    th, td { border: 1px solid #ddd; padding: 6px 10px; }
    th { background: rgba(0,0,0,0.05); }
`;

/**
 * Generate HTML export of the conversation
 */
export function exportAsHtml(clusters: SearchableCluster[], title: string): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${HTML_EXPORT_STYLES}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
`;

  for (const cluster of clusters) {
    html += `  <div class="turn">\n`;

    // User message
    if (cluster.userText) {
      html += `    <div class="user">
      <div class="user-label">User</div>
      <div>${renderMarkdown(cluster.userText)}</div>
    </div>\n`;
    }

    // Assistant section
    html += `    <div class="assistant">\n`;

    // Thinking blocks
    for (const thinking of cluster.thinkingBlocks) {
      html += `      <details class="thinking">
        <summary class="thinking-header">Thinking (${thinking.length.toLocaleString()} chars)</summary>
        <div class="thinking-content">${renderMarkdown(thinking)}</div>
      </details>\n`;
    }

    // Tool calls and results
    for (let t = 0; t < cluster.toolUses.length; t++) {
      const toolUse = cluster.toolUses[t];
      html += `      <details class="tool">
        <summary class="tool-header">Tool: ${escapeHtml(toolUse.name)}</summary>
        <div class="tool-content">${escapeHtml(toolUse.input)}</div>
      </details>\n`;

      if (t < cluster.toolResults.length) {
        const toolResult = cluster.toolResults[t];
        const resultClass = toolResult.isError ? 'tool tool-error' : 'tool tool-result';
        html += `      <details class="${resultClass}">
        <summary class="tool-header">${toolResult.isError ? 'Error' : 'Result'}</summary>
        <div class="tool-content">${escapeHtml(toolResult.content)}</div>
      </details>\n`;
      }
    }

    // Assistant text
    if (cluster.assistantText) {
      html += `      <div class="text">${renderMarkdown(cluster.assistantText)}</div>\n`;
    }

    html += `    </div>\n`;
    html += `  </div>\n`;
  }

  html += `  <div class="meta">Exported from Thinking Tracer on ${new Date().toLocaleString()}</div>
</body>
</html>`;

  return html;
}

/**
 * Generate Markdown export of the conversation
 */
export function exportAsMarkdown(clusters: SearchableCluster[], title: string): string {
  let md = `# ${title}\n\n`;

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    md += `---\n\n`;
    md += `## Turn ${i + 1}\n\n`;

    // User message
    if (cluster.userText) {
      md += `### User\n\n${cluster.userText}\n\n`;
    }

    // Assistant section
    md += `### Assistant\n\n`;

    // Thinking blocks
    for (const thinking of cluster.thinkingBlocks) {
      md += `<details>\n<summary>Thinking (${thinking.length.toLocaleString()} chars)</summary>\n\n\`\`\`\n${thinking}\n\`\`\`\n\n</details>\n\n`;
    }

    // Tool calls and results
    for (let t = 0; t < cluster.toolUses.length; t++) {
      const toolUse = cluster.toolUses[t];
      md += `<details>\n<summary>Tool: ${toolUse.name}</summary>\n\n\`\`\`\n${toolUse.input}\n\`\`\`\n\n</details>\n\n`;

      if (t < cluster.toolResults.length) {
        const toolResult = cluster.toolResults[t];
        const label = toolResult.isError ? 'Error' : 'Result';
        md += `<details>\n<summary>${label}</summary>\n\n\`\`\`\n${toolResult.content}\n\`\`\`\n\n</details>\n\n`;
      }
    }

    // Assistant text
    if (cluster.assistantText) {
      md += `${cluster.assistantText}\n\n`;
    }
  }

  md += `---\n\n*Exported from Thinking Tracer on ${new Date().toLocaleString()}*\n`;

  return md;
}
