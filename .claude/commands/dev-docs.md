---
description: Create dev docs for a new feature or task with plan, context, and task tracking files
argument-hint: feature or task name (e.g., "add team logos", "refactor draft timer")
---

Create development documentation for the following feature or task: $ARGUMENTS

## Instructions

1. **Analyze the request**: Research the codebase to understand what's involved. Identify relevant files, patterns, dependencies, and potential risks.

2. **Create the task directory**:
   ```
   dev/active/[task-name]/
   ```
   Use kebab-case for the directory name (e.g., `add-team-logos`, `refactor-draft-timer`).

3. **Generate three files**:

### [task-name]-plan.md

Write a comprehensive plan including:
- **Summary**: What is being built and why
- **Current State**: Relevant existing code and patterns
- **Approach**: Step-by-step implementation plan
- **Key Decisions**: Architectural choices and trade-offs
- **Risks**: What could go wrong, edge cases to watch for
- **Relevant Skills**: Which skills apply (frontend-dev, edge-functions, draft-logic)
- **Last Updated**: Today's date

### [task-name]-context.md

Document the implementation context:
- **Key Files**: Paths to all files that will be modified or referenced
- **Patterns to Follow**: Relevant conventions from skills (link to skill names)
- **Dependencies**: What this feature depends on and what depends on it
- **Integration Points**: How this connects to existing features
- **Decisions Made**: Any choices made during planning with rationale
- **Last Updated**: Today's date

### [task-name]-tasks.md

Create an ordered checklist:
- Use `- [ ]` format for each task
- Order by implementation sequence
- Group by phase if the feature is large
- Include acceptance criteria for each task
- Note any draft logic duplication concerns (frontend + edge functions)
- **Last Updated**: Today's date

## Quality Standards

- Plans must be **self-contained** — they should provide enough context to resume work after context compaction
- Reference **specific file paths** and line numbers where relevant
- Include **code snippets** for complex patterns
- Note any **draft logic duplication** concerns (see draft-logic skill)
- Reference relevant **skills** by name (frontend-dev, edge-functions, draft-logic)
