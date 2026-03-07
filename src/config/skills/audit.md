---
name: Audit
description: "Run a structured audit of graph quality, skill quality, and operational consistency."
when_to_use: "User asks for review, QA, cleanup, or governance checks."
when_not_to_use: "Simple one-off write/read requests."
success_criteria: "Findings are prioritized, concrete, and tied to actionable fixes."
---

# Audit

## Scope

1. Node quality: duplicates, vague descriptions, missing dates, weak titles.
2. Edge quality: missing links, weak explanations, wrong directionality.
3. Dimension quality: drift, overlap, low-signal categories.
4. Skill quality: trigger clarity, overlap, dead/unused skills.

## Output Format

1. Critical issues
2. High-impact improvements
3. Cleanup actions
4. Optional refinements

## Rules

- Prefer specific evidence over generic commentary.
- Propose the smallest high-leverage fixes first.
- Separate defects from optional polish.
