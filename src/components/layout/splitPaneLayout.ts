const SPLIT_HANDLE_WIDTH_PX = 8;

export function getSplitPaneReservedWidthPx(): number {
  return SPLIT_HANDLE_WIDTH_PX;
}

export function getSplitPaneBasis(widthPercent: number): string {
  const clampedWidth = Math.max(0, Math.min(100, widthPercent));
  const reservedWidthPx = getSplitPaneReservedWidthPx();

  return `calc((100% - ${reservedWidthPx}px) * ${clampedWidth / 100})`;
}
