import { describe, expect, it } from 'vitest';

import { reduceMobileRoute } from '@/components/mobile/mobileRoutes';

describe('reduceMobileRoute', () => {
  it('opens note detail from the notes list', () => {
    const next = reduceMobileRoute(
      { screen: 'notes' },
      { type: 'open-note', nodeId: 7 },
    );

    expect(next).toEqual({ screen: 'detail', nodeId: 7 });
  });

  it('returns to notes when backing out from search', () => {
    const next = reduceMobileRoute(
      { screen: 'search' },
      { type: 'back' },
    );

    expect(next).toEqual({ screen: 'notes' });
  });

  it('opens add and search as full-screen flows', () => {
    expect(reduceMobileRoute({ screen: 'notes' }, { type: 'open-search' })).toEqual({ screen: 'search' });
    expect(reduceMobileRoute({ screen: 'notes' }, { type: 'open-add' })).toEqual({ screen: 'add' });
  });

  it('opens note child screens from detail and returns to detail on back', () => {
    expect(
      reduceMobileRoute({ screen: 'detail', nodeId: 9 }, { type: 'open-child', child: 'source' }),
    ).toEqual({ screen: 'child', nodeId: 9, child: 'source' });

    expect(
      reduceMobileRoute({ screen: 'child', nodeId: 9, child: 'metadata' }, { type: 'back' }),
    ).toEqual({ screen: 'detail', nodeId: 9 });
  });
});
