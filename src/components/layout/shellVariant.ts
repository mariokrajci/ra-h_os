import type { LayoutMode } from './layoutMode';

export type ShellVariant = 'mobile' | 'tablet' | 'desktop';

export function getShellVariant(layoutMode: LayoutMode): ShellVariant {
  if (layoutMode === 'phone') return 'mobile';
  if (layoutMode === 'tablet') return 'tablet';
  return 'desktop';
}
