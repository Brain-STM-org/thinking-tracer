# Session Merge Analysis Report

## Overview

Analysis of Claude Code session traces for the thinking-trace-viewer project, exploring the possibility of merging interrupted/multiple sessions into a unified trace.

## Session Timeline

| Session | ID | Start | End | Lines | Size | Description |
|---------|-----|-------|-----|-------|------|-------------|
| 1 | `64bace9d` | Jan 22 21:22 | Jan 22 22:15 | 180 | 460KB | Initial documentation |
| 2 | `f8e63d17` | Jan 22 22:16 | Jan 23 23:02 | 3,794 | 28MB | Main development |
| Sample | (subset of 2) | Jan 22 22:16 | Jan 23 19:28 | 2,648 | 19MB | Current sample |

## Key Findings

### 1. Sessions are Sequential
The first session ended at 22:15 and the second started at 22:16 - they are chronologically adjacent with only a 1-minute gap. This is a perfect candidate for merging.

### 2. First Session Content
The earlier session (`64bace9d`) contains initial documentation work:
- First prompt: "read agents.md and fill out all the documentation files"
- 15 messages over ~54 minutes
- Establishes project context and structure

### 3. Sample is a Snapshot
The current sample trace is a point-in-time copy from the ongoing session, missing:
- The earlier documentation session (180 lines of context)
- Recent work since Jan 23 19:28 (~1,146 additional lines)

## Merge Approach

### Simple Concatenation
Since JSONL is line-delimited, merging is straightforward:

```bash
cat session1.jsonl session2.jsonl > merged.jsonl
```

However, considerations:
1. **Session IDs differ** - Each session has its own UUID
2. **Snapshot records** - May need filtering/handling
3. **Message continuity** - `parentUuid` links may break across sessions

### Recommended Merge Strategy

1. **Preserve original session boundaries** - Add a marker/separator
2. **Filter snapshot updates** - These are internal state, not conversation
3. **Sort by timestamp** - Ensure chronological order
4. **Update metadata** - Combine message counts, adjust summaries

## Use Cases for Session Merging

### 1. Interrupted Work Sessions
When work spans multiple Claude Code sessions due to:
- Context window limits triggering new sessions
- Manual session restarts
- Crashes or disconnections

### 2. Project Documentation
Creating a complete development history for:
- Post-mortems and retrospectives
- Training data curation
- Knowledge transfer

### 3. Analysis and Visualization
The thinking-trace-viewer could benefit from:
- Showing session boundaries visually
- Allowing users to merge sessions in the UI
- Timeline view across multiple sessions

## Proposed Feature: Session Merge Tool

### CLI Utility
```bash
# Merge multiple sessions
npx thinking-tracer merge session1.jsonl session2.jsonl -o combined.jsonl

# Merge all sessions in a project directory
npx thinking-tracer merge ~/.claude/projects/my-project/*.jsonl -o full-history.jsonl
```

### UI Feature
- Drag multiple JSONL files to merge
- Visual timeline showing session boundaries
- Option to export merged trace

## Implementation Notes

### JSONL Record Types
From analysis, records include:
- `user` - User messages with prompts
- `assistant` - Claude responses with thinking
- `system` - System events
- `snapshot` - Internal state (can be filtered)

### Metadata to Preserve
- `timestamp` - For ordering
- `sessionId` - For grouping/boundaries
- `message` - Core content
- `parentUuid` - Message threading (within session)

## Recommendation

1. **Immediate**: Create merged sample including the earlier documentation session
2. **Short-term**: Add session merge utility script
3. **Medium-term**: Add UI support for multi-file loading and session visualization

## Merged Sample Creation

To create a complete sample with both sessions:

```bash
# Filter out snapshot updates (type: isSnapshotUpdate) and merge
cat ~/.claude/projects/-Users-evan-brainstm-thinking-trace-viewer/64bace9d-*.jsonl \
    ~/.claude/projects/-Users-evan-brainstm-thinking-trace-viewer/f8e63d17-*.jsonl \
    | grep -v '"isSnapshotUpdate":true' \
    > public/samples/sample-trace-complete.jsonl
```

---

*Generated: 2026-01-23*
