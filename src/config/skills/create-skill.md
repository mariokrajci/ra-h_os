---
name: Create Skill
description: "Design or refine a skill using a tight trigger, explicit contract, and measurable outcomes."
when_to_use: "User asks to create, rewrite, or improve a skill."
when_not_to_use: "Task is normal graph operation and no new skill is needed."
success_criteria: "Skill has clear trigger boundaries, execution steps, guardrails, and evaluation hooks."
---

# Create Skill

## Objective

Create skills that are precise, callable, and testable.

## Skill Design Standard

1. Define trigger boundary clearly: when to use and when not to use.
2. Define required outputs and quality bar.
3. Specify concrete execution sequence.
4. Add hard guardrails (what to reject/avoid).
5. Keep it short; remove fluff and duplicate policy text.

## Required Structure

- `name`
- `description`
- `when_to_use`
- `when_not_to_use`
- `success_criteria`
- Step-by-step procedure
- Do-not list

## Validation Checklist

- Can another agent execute this without guessing?
- Does it avoid overlap with existing skills?
- Are failure modes explicit?
- Is there an obvious way to evaluate success?

## Consolidation Rule

If two skills have the same trigger + same tool path + same output contract, merge them.
