/**
 * Tests for export functionality
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  renderMarkdown,
  getSafeFilename,
  exportAsHtml,
  exportAsMarkdown,
  type SearchableCluster,
} from './exporter';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say "hello"');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('passes through plain text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const result = renderMarkdown('**bold**');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('renders code blocks', () => {
    const result = renderMarkdown('`code`');
    expect(result).toContain('<code>code</code>');
  });

  it('renders links', () => {
    const result = renderMarkdown('[link](https://example.com)');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('>link</a>');
  });

  it('handles empty string', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('handles null-ish input gracefully', () => {
    expect(renderMarkdown(null as unknown as string)).toBe('');
    expect(renderMarkdown(undefined as unknown as string)).toBe('');
  });
});

describe('getSafeFilename', () => {
  it('converts spaces to hyphens', () => {
    expect(getSafeFilename('My Conversation')).toBe('my-conversation');
  });

  it('removes special characters', () => {
    expect(getSafeFilename('file:name/with\\special?chars')).toBe('filenamewithspecialchars');
  });

  it('truncates long names to 50 characters', () => {
    const longName = 'a'.repeat(100);
    expect(getSafeFilename(longName).length).toBe(50);
  });

  it('returns "conversation" for empty input', () => {
    expect(getSafeFilename('')).toBe('conversation');
  });

  it('returns "conversation" for input with only special chars', () => {
    expect(getSafeFilename('!@#$%^&*()')).toBe('conversation');
  });

  it('converts to lowercase', () => {
    expect(getSafeFilename('UPPERCASE')).toBe('uppercase');
  });

  it('preserves hyphens', () => {
    expect(getSafeFilename('my-file-name')).toBe('my-file-name');
  });

  it('collapses multiple spaces', () => {
    expect(getSafeFilename('too   many   spaces')).toBe('too-many-spaces');
  });
});

describe('exportAsHtml', () => {
  const sampleClusters: SearchableCluster[] = [
    {
      clusterIndex: 0,
      userText: 'Hello, how are you?',
      assistantText: 'I am doing well, thank you!',
      thinkingBlocks: ['Let me consider this...'],
      toolUses: [{ name: 'read_file', input: '{"path": "/test.txt"}' }],
      toolResults: [{ content: 'File contents here', isError: false }],
    },
  ];

  it('generates valid HTML structure', () => {
    const html = exportAsHtml(sampleClusters, 'Test Conversation');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
  });

  it('includes the title', () => {
    const html = exportAsHtml(sampleClusters, 'My Test Title');

    expect(html).toContain('<title>My Test Title</title>');
    expect(html).toContain('<h1>My Test Title</h1>');
  });

  it('escapes title to prevent XSS', () => {
    const html = exportAsHtml(sampleClusters, '<script>alert("xss")</script>');

    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes user messages', () => {
    const html = exportAsHtml(sampleClusters, 'Test');

    expect(html).toContain('Hello, how are you?');
    expect(html).toContain('class="user"');
    expect(html).toContain('User</div>');
  });

  it('includes assistant text', () => {
    const html = exportAsHtml(sampleClusters, 'Test');

    expect(html).toContain('I am doing well, thank you!');
    expect(html).toContain('class="text"');
  });

  it('includes thinking blocks as collapsible details', () => {
    const html = exportAsHtml(sampleClusters, 'Test');

    expect(html).toContain('<details class="thinking">');
    expect(html).toContain('Let me consider this...');
    expect(html).toContain('Thinking (');
  });

  it('includes tool calls', () => {
    const html = exportAsHtml(sampleClusters, 'Test');

    expect(html).toContain('Tool: read_file');
    expect(html).toContain('{"path": "/test.txt"}');
  });

  it('includes tool results', () => {
    const html = exportAsHtml(sampleClusters, 'Test');

    expect(html).toContain('File contents here');
    expect(html).toContain('class="tool tool-result"');
  });

  it('marks error results differently', () => {
    const clusters: SearchableCluster[] = [
      {
        clusterIndex: 0,
        userText: '',
        assistantText: '',
        thinkingBlocks: [],
        toolUses: [{ name: 'test', input: '{}' }],
        toolResults: [{ content: 'Error occurred', isError: true }],
      },
    ];

    const html = exportAsHtml(clusters, 'Test');

    expect(html).toContain('class="tool tool-error"');
    expect(html).toContain('>Error</summary>');
  });

  it('includes export timestamp', () => {
    const html = exportAsHtml(sampleClusters, 'Test');

    expect(html).toContain('Exported from Thinking Tracer on');
    expect(html).toContain('class="meta"');
  });

  it('handles empty clusters', () => {
    const html = exportAsHtml([], 'Empty');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<h1>Empty</h1>');
    expect(html).not.toContain('class="turn"');
  });

  it('includes CSS styles', () => {
    const html = exportAsHtml(sampleClusters, 'Test');

    expect(html).toContain('<style>');
    expect(html).toContain('.turn {');
    expect(html).toContain('.thinking {');
  });
});

describe('exportAsMarkdown', () => {
  const sampleClusters: SearchableCluster[] = [
    {
      clusterIndex: 0,
      userText: 'Hello, how are you?',
      assistantText: 'I am doing well, thank you!',
      thinkingBlocks: ['Let me consider this...'],
      toolUses: [{ name: 'read_file', input: '{"path": "/test.txt"}' }],
      toolResults: [{ content: 'File contents here', isError: false }],
    },
  ];

  it('starts with title as H1', () => {
    const md = exportAsMarkdown(sampleClusters, 'My Conversation');

    expect(md.startsWith('# My Conversation\n')).toBe(true);
  });

  it('includes turn separators', () => {
    const md = exportAsMarkdown(sampleClusters, 'Test');

    expect(md).toContain('---');
    expect(md).toContain('## Turn 1');
  });

  it('includes user section', () => {
    const md = exportAsMarkdown(sampleClusters, 'Test');

    expect(md).toContain('### User');
    expect(md).toContain('Hello, how are you?');
  });

  it('includes assistant section', () => {
    const md = exportAsMarkdown(sampleClusters, 'Test');

    expect(md).toContain('### Assistant');
    expect(md).toContain('I am doing well, thank you!');
  });

  it('includes thinking blocks as details/summary', () => {
    const md = exportAsMarkdown(sampleClusters, 'Test');

    expect(md).toContain('<details>');
    expect(md).toContain('<summary>Thinking (');
    expect(md).toContain('Let me consider this...');
    expect(md).toContain('</details>');
  });

  it('includes tool calls as details/summary', () => {
    const md = exportAsMarkdown(sampleClusters, 'Test');

    expect(md).toContain('<summary>Tool: read_file</summary>');
    expect(md).toContain('{"path": "/test.txt"}');
  });

  it('includes tool results', () => {
    const md = exportAsMarkdown(sampleClusters, 'Test');

    expect(md).toContain('<summary>Result</summary>');
    expect(md).toContain('File contents here');
  });

  it('marks errors in tool results', () => {
    const clusters: SearchableCluster[] = [
      {
        clusterIndex: 0,
        userText: '',
        assistantText: '',
        thinkingBlocks: [],
        toolUses: [{ name: 'test', input: '{}' }],
        toolResults: [{ content: 'Something failed', isError: true }],
      },
    ];

    const md = exportAsMarkdown(clusters, 'Test');

    expect(md).toContain('<summary>Error</summary>');
  });

  it('includes export timestamp', () => {
    const md = exportAsMarkdown(sampleClusters, 'Test');

    expect(md).toContain('*Exported from Thinking Tracer on');
  });

  it('handles empty clusters', () => {
    const md = exportAsMarkdown([], 'Empty');

    expect(md).toContain('# Empty');
    expect(md).not.toContain('## Turn');
  });

  it('numbers multiple turns correctly', () => {
    const clusters: SearchableCluster[] = [
      {
        clusterIndex: 0,
        userText: 'First',
        assistantText: 'Response 1',
        thinkingBlocks: [],
        toolUses: [],
        toolResults: [],
      },
      {
        clusterIndex: 1,
        userText: 'Second',
        assistantText: 'Response 2',
        thinkingBlocks: [],
        toolUses: [],
        toolResults: [],
      },
    ];

    const md = exportAsMarkdown(clusters, 'Test');

    expect(md).toContain('## Turn 1');
    expect(md).toContain('## Turn 2');
  });
});
