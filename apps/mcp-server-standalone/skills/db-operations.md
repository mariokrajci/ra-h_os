---
name: DB Operations
description: "Use this for all graph read/write operations with strict data quality standards."
when_to_use: "Any request to read, create, update, connect, classify, or traverse graph data."
when_not_to_use: "Pure conversation with no graph interaction needed."
success_criteria: "Writes are explicit and correct; descriptions are concrete; edges and dimensions are high-signal."
---

# DB Operations

## Core Rules

1. Search before create to avoid duplicates.
2. Every create/update must include an explicit description of WHAT the thing is and WHY it matters.
3. Use event dates when known (when it happened, not when saved).
4. Apply dimensions deliberately; prefer existing dimensions over creating noisy new ones.
5. Create edges when relationships are meaningful; edge explanations should read as a sentence.

## Write Quality Contract

- `title`: clear and specific.
- `description`: concrete object-level description, not vague summaries.
- `notes/content`: extra context, analysis, supporting detail.
- `link`: external source URL only.

## Execution Pattern

1. Read context (search + relevant nodes + relevant edges).
2. Decide: create vs update vs connect.
3. Execute minimum required writes.
4. Verify result reflects user intent exactly.

## Do Not

- Create duplicate nodes when an update is correct.
- Write vague descriptions ("discusses", "explores", "is about").
- Create weak or directionless edges.
