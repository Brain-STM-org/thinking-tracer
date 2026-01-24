# Security Audit Report: Thinking Trace Viewer

**Date:** 2026-01-24
**Auditor:** Red Team Security Review
**Scope:** Full codebase security review assuming adversarial input

---

## Executive Summary

This security audit examines a browser-based 3D visualization tool for LLM conversation traces. The application processes untrusted user-provided trace files (JSON/JSONL), stores data in IndexedDB, and renders content using markdown parsing and DOM manipulation.

**Overall Security Posture: MODERATE**

The application demonstrates security awareness with the use of DOMPurify for markdown sanitization and escapeHtml for text output. However, several areas require attention, particularly around input validation, resource exhaustion, and data storage practices.

### Findings Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 4 |
| Low | 6 |
| Informational | 5 |

---

## 1. Critical Vulnerabilities

*No critical vulnerabilities (remote code execution, authentication bypass, data breach) were identified.*

---

## 2. High Risk Issues

### H1: Regular Expression Denial of Service (ReDoS)

**Severity:** High
**Location:** `src/search/searcher.ts:90-91`

**Description:**
The search functionality allows users to enter arbitrary regex patterns that are compiled and executed against potentially large conversation trace content. Malicious regex patterns can cause catastrophic backtracking, freezing the browser tab.

**Vulnerable Code:**
```typescript
// src/search/searcher.ts:90-91
const regex = new RegExp(query, 'i');
const match = text.match(regex);
```

**Proof of Concept:**
1. User enables regex mode in search
2. User enters pattern: `(a+)+$`
3. Search text contains: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab`
4. Browser tab becomes unresponsive for extended period

**Recommended Fix:**
1. Add regex execution timeout using a Web Worker
2. Implement regex complexity validation before execution
3. Use a safe regex library like `safe-regex` or `re2` (WebAssembly port)
4. Add regex execution time limit with `Promise.race()` pattern

```typescript
// Example fix using Web Worker timeout
async function safeRegexMatch(pattern: string, text: string, timeoutMs = 100): Promise<RegExpMatchArray | null> {
  return Promise.race([
    new Promise<RegExpMatchArray | null>((resolve) => {
      try {
        const regex = new RegExp(pattern, 'i');
        resolve(text.match(regex));
      } catch {
        resolve(null);
      }
    }),
    new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Regex timeout')), timeoutMs)
    )
  ]);
}
```

---

### H2: Decompression Bomb (Zip Bomb) Vulnerability

**Severity:** High
**Location:** `src/utils/file-drop.ts:161-173`

**Description:**
The application accepts gzip and zstd compressed files without checking decompressed size limits. An attacker could provide a small compressed file that expands to gigabytes of data, exhausting browser memory and causing denial of service.

**Vulnerable Code:**
```typescript
// src/utils/file-drop.ts:161-164
if (name.endsWith('.gz')) {
  const ds = new DecompressionStream('gzip');
  const stream = file.stream().pipeThrough(ds);
  return await new Response(stream).text(); // No size limit
}
```

**Proof of Concept:**
A 45KB gzip file can decompress to 4.5GB, crashing the browser tab.

**Recommended Fix:**
1. Implement streaming decompression with size tracking
2. Abort decompression if size exceeds limit (e.g., 100MB)
3. Reject files with suspiciously high compression ratios (>100:1)
4. Show progress and allow cancellation

```typescript
async function decompressWithLimit(file: File, maxBytes: number): Promise<string> {
  const ds = new DecompressionStream('gzip');
  const reader = file.stream().pipeThrough(ds).getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.length;
    if (totalBytes > maxBytes) {
      reader.cancel();
      throw new Error(`Decompressed size exceeds limit of ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(concatUint8Arrays(chunks));
}
```

---

## 3. Medium Risk Issues

### M1: IndexedDB Data Exposure

**Severity:** Medium
**Location:** `src/utils/recent-traces.ts:72-105`

**Description:**
The application stores complete trace file contents in IndexedDB without encryption. Any malicious script running on the same origin (through XSS or browser extensions) can access stored conversation data, which may contain sensitive information like API keys, file paths, credentials, or confidential business logic.

**Vulnerable Code:**
```typescript
// src/utils/recent-traces.ts:81-88
const trace: RecentTrace = {
  id: hashContent(content),
  filename,
  title,
  lastOpened: Date.now(),
  turnCount,
  content,  // Full trace content stored unencrypted
  size: new Blob([content]).size,
};
```

**Recommended Fix:**
1. Add option to disable trace caching entirely
2. Consider encryption using Web Crypto API with user-provided key
3. Add prominent warning about data storage in UI
4. Implement automatic expiration/cleanup of old traces

---

### M2: Weak Content Hash for Deduplication

**Severity:** Medium
**Location:** `src/utils/hash.ts:12-22`

**Description:**
The hash function used for trace identification only processes the first 10,000 characters and uses a simple djb2-like algorithm with 32-bit collision space. This creates hash collision risks where different traces could overwrite each other in storage.

**Vulnerable Code:**
```typescript
// src/utils/hash.ts:16-21
const len = Math.min(content.length, 10000);
for (let i = 0; i < len; i++) {
  const char = content.charCodeAt(i);
  hash = ((hash << 5) - hash) + char;
  hash = hash & hash; // 32-bit integer
}
```

**Attack Scenario:**
Two traces with identical 10KB prefixes but different content would receive the same ID, causing one to overwrite the other.

**Recommended Fix:**
1. Use Web Crypto API's `crypto.subtle.digest()` with SHA-256
2. Hash the entire content (stream if needed for large files)
3. Include file size in the ID to reduce collisions

```typescript
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

---

### M3: Prototype Pollution via JSON Parsing

**Severity:** Medium
**Location:** `src/data/parsers/claude-code.ts:154-156`

**Description:**
The JSONL parser uses `JSON.parse()` on each line of user-provided content. While modern browsers protect against `__proto__` assignments in JSON.parse, the parsed objects are then spread/assigned to other objects, potentially allowing property injection.

**Vulnerable Code:**
```typescript
// src/data/parsers/claude-code.ts:155
lines.push(JSON.parse(trimmed));
```

**Recommended Fix:**
1. Validate expected structure before use
2. Use `Object.create(null)` for data containers
3. Implement allowlist validation for expected properties

---

### M4: Memory Exhaustion via Large Traces

**Severity:** Medium
**Location:** `src/core/Viewer.ts:611-627`

**Description:**
Loading extremely large conversation traces (thousands of turns with extensive tool outputs) can exhaust browser memory. The application creates Three.js objects for each cluster and stores all searchable content in memory with no limits.

**Recommended Fix:**
1. Implement virtualization for large traces
2. Lazy-load node geometries
3. Add configurable limits on trace size
4. Stream parse large files progressively
5. Show warning for traces exceeding thresholds

---

## 4. Low Risk Issues

### L1: Missing Security Headers

**Severity:** Low
**Location:** Deployment configuration

**Description:**
No Content Security Policy or other security headers are configured for deployment.

**Recommended Fix:**
Add to deployment server or `<meta>` tag:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

---

### L2: Development Server Binds to All Interfaces

**Severity:** Low
**Location:** `vite.config.ts:40`

**Description:**
The development server is configured with `host: '0.0.0.0'`, making it accessible from any network interface.

**Recommended Fix:**
Use `host: 'localhost'` for development unless network access is specifically needed.

---

### L3: Unvalidated External URL Fetching

**Severity:** Low
**Location:** `src/ui/loaders/FileLoader.ts:313-334`

**Description:**
The `loadFromUrl` method fetches content from arbitrary URLs without validation. While currently only used for the sample trace, the public method could be misused.

**Recommended Fix:**
1. Validate URLs against an allowlist of trusted origins
2. Make method private or add origin validation

---

### L4: No Input Length Limits on Search

**Severity:** Low
**Location:** `src/search/searcher.ts:166-177`

**Description:**
Search queries have no length limits. Extremely long search strings could cause performance issues.

**Recommended Fix:**
Add maximum query length limit (e.g., 1000 characters).

---

### L5: innerHTML Usage for Stats Display

**Severity:** Low
**Location:** `src/main.ts:236-244`

**Description:**
Stats display uses innerHTML but data appears to come from controlled numeric sources. Should use textContent for safety and consistency.

**Recommended Fix:**
```typescript
statsEl.textContent = [...].join(' | ');
```

---

### L6: Sensitive Data in Tool Results

**Severity:** Low
**Location:** Various (tool_result handling)

**Description:**
Tool results may contain sensitive file contents, environment variables, or system information that gets stored in IndexedDB and displayed in the UI.

**Recommended Fix:**
1. Add warning when loading traces containing tool results
2. Consider redaction patterns for known sensitive data
3. Document data handling in privacy notice

---

## 5. Informational Findings

### I1: DOMPurify Usage - Good Practice ✓

**Location:** `src/export/exporter.ts:31-40`

The application correctly uses DOMPurify v3.3.1 for sanitizing markdown-rendered HTML content:

```typescript
export function renderMarkdown(text: string): string {
  if (!text) return '';
  try {
    const html = marked.parse(text) as string;
    return DOMPurify.sanitize(html);
  } catch {
    return escapeHtml(text);
  }
}
```

---

### I2: escapeHtml Implementation - Good Practice ✓

**Location:** `src/export/exporter.ts:21-25`

The escapeHtml function uses the DOM textContent property correctly:

```typescript
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

---

### I3: No Dangerous Code Patterns ✓

Code review confirms:
- No use of `eval()`, `Function()`, or `new Function()`
- No dynamic script injection
- No unsafe innerHTML with user content (DOMPurify used)

---

### I4: Proper Resource Disposal ✓

Three.js resources (geometries, materials, textures) are properly disposed when clearing nodes, preventing WebGL resource leaks.

---

### I5: Third-Party Dependencies

| Package | Version | Status |
|---------|---------|--------|
| dompurify | ^3.3.1 | ✓ Actively maintained |
| marked | ^17.0.1 | ✓ Current release |
| three | ^0.171.0 | ✓ Current release |
| fzstd | ^0.1.1 | ✓ Small footprint |

**Note:** `npm audit` reports 5 moderate vulnerabilities in dev dependencies (vitest, vite). These do not affect production builds.

---

## 6. Recommendations - Prioritized

### Immediate (Before Production)

| Priority | Issue | Effort |
|----------|-------|--------|
| 1 | Fix ReDoS vulnerability (H1) | Medium |
| 2 | Add decompression limits (H2) | Medium |
| 3 | Add security headers (L1) | Low |

### Short-Term (Next Release)

| Priority | Issue | Effort |
|----------|-------|--------|
| 4 | Improve hash function to SHA-256 (M2) | Low |
| 5 | Add trace size warnings (M4) | Low |
| 6 | Add data privacy controls (M1) | Medium |

### Long-Term

| Priority | Issue | Effort |
|----------|-------|--------|
| 7 | Encrypt stored data (M1) | High |
| 8 | Implement virtualization for large traces (M4) | High |
| 9 | Add automated security testing in CI | Medium |

---

## 7. Threat Model Summary

| Threat | Likelihood | Impact | Status |
|--------|------------|--------|--------|
| XSS via malicious trace | Medium | High | **Mitigated** (DOMPurify) |
| ReDoS via search regex | Medium | Medium | **Not mitigated** |
| Decompression bomb | Low | High | **Not mitigated** |
| Memory exhaustion | Low | Medium | Partially mitigated |
| Data exposure via storage | Low | Medium | Documented |
| Prototype pollution | Low | Low | Likely mitigated |

---

## 8. Files Reviewed

- `src/main.ts` - Entry point, DOM setup
- `src/export/exporter.ts` - Markdown rendering, HTML export
- `src/data/parsers/claude-code.ts` - JSONL parsing
- `src/utils/file-drop.ts` - File handling, decompression
- `src/utils/recent-traces.ts` - IndexedDB storage
- `src/utils/hash.ts` - Content hashing
- `src/ui/loaders/FileLoader.ts` - File loading
- `src/ui/loaders/RecentTracesManager.ts` - Storage UI
- `src/ui/panels/*.ts` - DOM rendering panels
- `src/ui/search/SearchController.ts` - Search UI
- `src/search/searcher.ts` - Search logic
- `src/core/Viewer.ts` - 3D visualization
- `src/styles/main.css` - Styles
- `package.json` - Dependencies
- `index.html` - HTML template
- `vite.config.ts` - Build configuration

---

## 9. Conclusion

The Thinking Trace Viewer demonstrates good security awareness with proper XSS prevention through DOMPurify and consistent HTML escaping. The client-side architecture inherently limits the blast radius of potential vulnerabilities.

The primary concerns are denial-of-service vectors (ReDoS, decompression bombs, memory exhaustion) that could crash the browser tab. These should be addressed before production deployment but do not pose data breach or remote code execution risks.

**Overall Risk Rating: MEDIUM**

Address high-priority items (H1, H2) before production use.

---

*Report generated by Red Team Security Audit*
