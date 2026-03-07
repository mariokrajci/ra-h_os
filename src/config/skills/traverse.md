---
name: Traverse
description: "Gather deeper context by traversing connected nodes before answering."
when_to_use: "Question benefits from broader context than a single direct lookup."
when_not_to_use: "Simple factual answer can be resolved from one direct node."
success_criteria: "Answer is grounded in relevant connected context without over-traversal noise."
---

# Traverse

## Strategy

1. Start with seed nodes from the user query.
2. Expand neighbors breadth-first with depth limits.
3. Prioritize high-signal nodes (strong relevance + strong edge semantics).
4. Pull key evidence from top nodes.
5. Answer directly and explain why chosen nodes mattered.

## Defaults

- Depth: 2
- Seed count: 3-5
- Exploration budget: ~40 nodes

## Do Not

- Traverse without limits.
- Include distant low-signal nodes just to add volume.
