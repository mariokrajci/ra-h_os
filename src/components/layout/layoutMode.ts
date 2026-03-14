export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 1024;

export type LayoutMode = 'phone' | 'tablet' | 'desktop';

export function getLayoutMode(width: number): LayoutMode {
  if (width < MOBILE_BREAKPOINT) return 'phone';
  if (width < TABLET_BREAKPOINT) return 'tablet';
  return 'desktop';
}
