---
name: Persona
description: "Build and maintain a user-defined agent persona and interaction style profile."
when_to_use: "User asks to set or refine how the agent should behave."
when_not_to_use: "No behavior/persona request is present."
success_criteria: "Persona is explicit, editable, and consistently applied across interactions."
---

# Persona

## Objective

Make agent behavior fully malleable to the user.

## Capture Model

1. Communication style (directness, brevity, tone).
2. Thinking style (exploratory vs decisive, framework-heavy vs practical).
3. Decision style (challenge level, risk posture, evidence threshold).
4. Collaboration style (pushback expectations, cadence, format preferences).

## Persistence Pattern

- Store persona as explicit nodes (and updates over time), not hidden assumptions.
- Keep versioned changes visible to the user.

## Do Not

- Freeze persona permanently.
- Apply unstated style assumptions when user instructions conflict.
