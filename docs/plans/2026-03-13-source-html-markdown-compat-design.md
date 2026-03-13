# Source HTML Markdown Compatibility Design

## Goal

Render GitHub README content correctly in the Source tab when markdown includes embedded HTML table markup and inline HTML tags.

## Approach

Normalize the most common GitHub README HTML-table patterns into regular markdown before the Source parser runs. This keeps the fix focused on the broken content shape we observed, avoids adding a new parser dependency, and improves rendering for already-saved nodes.

## Scope

- Add a focused normalization step in [`src/components/focus/source/MappedMarkdownRenderer.tsx`](/home/mario/srv/apps/ra-h_os/src/components/focus/source/MappedMarkdownRenderer.tsx)
- Cover GitHub-style `<table>`, `<tr>`, `<td>`, `<th>`, `<code>`, `<a>`, and `<br>` handling with a regression test in [`tests/unit/markdownSourceMapping.test.ts`](/home/mario/srv/apps/ra-h_os/tests/unit/markdownSourceMapping.test.ts)

## Notes

This is intentionally a constrained compatibility layer, not a full arbitrary-HTML renderer. The first target is the HTML-heavy GitHub README format that currently leaks tags and indented pseudo-code blocks into the Source tab.
