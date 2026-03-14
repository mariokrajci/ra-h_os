export function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = now - then;

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;

  const thenDate = new Date(isoDate);
  const todayDate = new Date();
  const yesterday = new Date(todayDate);
  yesterday.setDate(todayDate.getDate() - 1);

  if (thenDate.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const opts: Intl.DateTimeFormatOptions =
    thenDate.getFullYear() === todayDate.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };

  return thenDate.toLocaleDateString(undefined, opts);
}
