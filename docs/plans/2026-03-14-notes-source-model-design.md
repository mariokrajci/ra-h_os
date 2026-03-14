# Notes vs Source Model Design

## Summary

RA-OS should treat `Notes`, `Source`, and `Description` as three distinct layers with different jobs:

- `Description` is a short orientation summary
- `Notes` is the user's synthesis layer
- `Source` is imported or extracted reference material

The current system allows `Notes` to be auto-generated from `Source`, which can create near-duplication and blur the meaning of each surface. This design proposes restoring a stronger separation between them.

## Problem

The original open-source model treated text notes and imported sources asymmetrically:

- text-first nodes primarily lived in `content`/`notes`
- imported material primarily lived in `chunk`/`source`
- empty `Notes` for source-backed nodes was acceptable

Later ingestion changes introduced automatic note generation from extracted source content. In practice, this can produce polished restatements of the source instead of real synthesis.

Node `1` is a concrete example:

- it is a GitHub-backed source node
- `Source` contains the extracted README
- `Notes` is very close to `Source` rather than being a selective synthesis

This weakens the conceptual distinction between note-taking and source storage.

## Goals

- Define a strong product contract for `Description`, `Notes`, and `Source`
- Avoid duplication between `Notes` and `Source`
- Keep empty `Notes` acceptable for source-backed nodes
- Preserve a clear user incentive to create meaningful notes
- Make mobile and desktop note detail behavior consistent with that model

## Non-Goals

- Removing `Source` support
- Removing `Description`
- Preventing optional AI assistance entirely
- Reworking the full ingestion architecture in this design document

## Product Definitions

### Description

`Description` is a compact orientation layer.

It is:

- a short summary under the title
- useful for list previews and quick recall
- suitable for AI/search context

It is not:

- the main note body
- a separate reading destination
- a substitute for `Notes`

### Notes

`Notes` is the intentional synthesis layer.

It is:

- the user's interpretation of a node
- the place for takeaways, implications, connections, questions, and decisions
- the main editable reading/writing surface for note-first nodes

It is not:

- a cleaned-up copy of `Source`
- a markdown restatement of extracted material
- required for every source-backed node

Key product rule:

`Notes` should answer "why this matters" more than "what this says."

### Source

`Source` is the reference layer.

It is:

- imported or extracted material
- README text, article text, transcript text, PDF text, or other raw source content
- the evidence behind the note

It is not:

- the user's synthesis
- the default place for note-taking
- something that must be mirrored into `Notes`

Key product rule:

`Source` answers "what it says."

## Canonical Model

The clean conceptual model is:

- `Description = what this is`
- `Notes = why it matters`
- `Source = what it says`

This gives each layer a distinct job and makes it easier to design both desktop and mobile note detail screens.

## Original Repo Behavior

The original open-source repo did not auto-populate `Notes` from `Source`.

Behaviorally:

- text-only notes primarily lived in `content` (later renamed `notes`)
- source-backed nodes primarily stored extracted material in `chunk`
- the app could mirror note content into `chunk` for embeddings when needed
- but it did not generate note content from extracted source by default

That means a source-backed node could legitimately have:

- `Description` present
- `Source` present
- `Notes` empty

This was a coherent and acceptable state.

## AI-Generated Notes Policy

AI-generated notes can still be useful, but they should be optional and explicit.

Recommended policy:

- do not auto-populate `Notes` from `Source` during ingestion by default
- allow explicit user actions such as `Generate notes from source` or `Summarize source`
- treat poor AI outputs that closely mirror source structure as low-quality results

If AI-generated notes are offered, they should be constrained to produce:

- concise synthesis
- key takeaways
- implications or action items
- optional links or follow-up questions

They should avoid:

- section-by-section paraphrase
- formatting-only transformations
- near-complete coverage of the source

## UX Implications

### Note Detail Defaults

Recommended default note detail hierarchy:

1. Title
2. Compact `Description` shown by default when present
3. `Notes` as the default primary content surface
4. Secondary navigation to `Source`, `Connections`, and `Metadata`

### Minimal Header Model

The top of a node should feel like note identity, not a control panel.

Current crowding comes from too many header-level elements competing at once:

- shell controls
- source attribution
- title and node identity
- dimensions
- primary actions
- tab navigation

Recommended structure:

1. Shell layer
2. Note identity layer
3. Context and navigation layer

The note identity layer should contain:

- title
- compact `Description` shown by default when present
- optional lightweight source attribution

The context and navigation layer should contain:

- dimensions as lightweight chips
- tabs for `Notes`, `Source`, and `Connections`
- minimal actions only

Header elements that should be demoted or removed from the top:

- full raw URL as a standalone line
- repeated connection counts outside the tab label
- large multi-button action clusters
- oversized dimension controls

Preferred principle:

If a piece of metadata is already represented in navigation, do not repeat it in the header unless it adds new meaning.

### Naming Guidance

Use separate language for the data model and the UI.

Internal/schema language:

- `edges`

User-facing UI language:

- `Connections`

Rationale:

- `edges` is accurate for the graph schema and implementation
- `Connections` is clearer and more natural in the note-reading experience
- the current codebase already mixes these concepts, so formalizing the distinction reduces confusion

This means the product can keep:

- `edges` in services, tables, and internal docs

while presenting:

- `Connections` in user-facing navigation and copy

### Empty Notes State

If `Notes` is empty:

- keep `Notes` as the primary concept
- show a purposeful empty state
- offer optional actions like `Write notes`, `View source`, or `Generate notes from source`

Avoid silently replacing empty notes with source content, because that weakens the distinction between the two layers.

### Related Node Creation

Creating a related node from within the current node is valuable and should remain part of the product.

It supports a natural graph-building workflow:

- the user is reading or writing
- a related idea appears
- they want to capture it without losing context

However, this action should not sit at the same priority level as `Edit`.

Recommended placement:

- a subtle inline CTA at the bottom of the `Notes` section
- optional secondary access from an overflow menu or `Connections`

Do not treat it as a top-level header action equal to `Edit`.

Recommended wording:

- `Create related node`

This is clearer than a generic `+ Node` button because it explains the intent of the action.

Example placement:

```text
[Notes content]

+ Create related node
```

If `Notes` is empty, the empty state can include:

- `Write notes`
- `View source`
- `Generate notes from source`
- `Create related node`

### Source-Backed Nodes

For source-backed nodes, an empty `Notes` state should be treated as normal rather than as missing required content.

The product should prefer:

- empty `Notes` plus meaningful `Source`

over:

- duplicated `Notes` plus `Source`

## Decision

RA-OS should not auto-populate `Notes` from `Source` by default.

Instead:

- `Source` should be ingested automatically
- `Description` may be generated automatically
- `Notes` should remain empty until created intentionally by the user or by an explicit AI action

This restores a clear product boundary and reduces low-value duplication.
