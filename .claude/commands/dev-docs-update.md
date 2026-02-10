---
description: Update active dev docs before context compaction or at the end of a work session
argument-hint: optional task name to focus on
---

Update development documentation to preserve progress before context compaction. $ARGUMENTS

## Instructions

### 1. Find Active Dev Docs

Check `dev/active/` for existing task directories. If a specific task name was provided, focus on that one. Otherwise, update all active tasks.

### 2. Update Task Files

For each active task:

**Update `[task-name]-tasks.md`**:
- Mark completed items: `- [ ]` → `- [x]`
- Add any new tasks discovered during implementation
- Update in-progress items with current status
- Reorder priorities if needed
- Update "Last Updated" timestamp

**Update `[task-name]-context.md`**:
- Add files modified this session and why
- Document key decisions made
- Note any blockers or issues discovered
- List next immediate steps (what to do when resuming)
- Add any new patterns or conventions learned
- Update "Last Updated" timestamp

### 3. Capture Session Context

Include information that would be hard to rediscover from code alone:
- Complex problems solved and how
- Architectural decisions made and their rationale
- Bugs found and fixed (especially subtle ones)
- Edge cases discovered
- Files that were tricky to modify and why

### 4. Document Unfinished Work

If work is incomplete:
- Exact state of partially completed features
- What was being worked on when the session ended
- Any uncommitted changes that need attention
- Commands to run on restart (e.g., deploy edge functions)
- Test commands to verify work
- Any temporary workarounds in place

### 5. Update Timestamps

Set "Last Updated: YYYY-MM-DD" in all modified files.

## Priority

Focus on information that would be **hard to rediscover** from code alone. Code changes are visible in git, but decisions, context, and next steps are not.
