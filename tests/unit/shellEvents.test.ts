import { describe, expect, it } from 'vitest';

import { reduceShellEvent, type ShellRefreshState } from '@/components/layout/shellEvents';
import type { DatabaseEvent } from '@/services/events';

function createState(overrides: Partial<ShellRefreshState> = {}): ShellRefreshState {
  return {
    nodes: 0,
    focus: 0,
    folder: 0,
    openLogEntry: false,
    ...overrides,
  };
}

describe('reduceShellEvent', () => {
  it('refreshes nodes for node creation', () => {
    const next = reduceShellEvent(
      createState(),
      { type: 'NODE_CREATED', data: { node: { title: 'Test' } }, timestamp: Date.now() },
      [],
    );

    expect(next.nodes).toBe(1);
    expect(next.focus).toBe(0);
  });

  it('refreshes nodes and focus when an open node updates', () => {
    const next = reduceShellEvent(
      createState(),
      { type: 'NODE_UPDATED', data: { nodeId: 42 }, timestamp: Date.now() },
      [42],
    );

    expect(next.nodes).toBe(1);
    expect(next.focus).toBe(1);
  });

  it('refreshes folder state for dimension updates', () => {
    const next = reduceShellEvent(
      createState(),
      { type: 'DIMENSION_UPDATED', data: {}, timestamp: Date.now() },
      [],
    );

    expect(next.nodes).toBe(1);
    expect(next.folder).toBe(1);
  });

  it('marks the log pane request when a log entry is selected event is replayed', () => {
    const next = reduceShellEvent(
      createState(),
      { type: 'GUIDE_UPDATED', data: {}, timestamp: Date.now() } as DatabaseEvent,
      [],
      { openLogEntry: true },
    );

    expect(next.openLogEntry).toBe(true);
  });
});
