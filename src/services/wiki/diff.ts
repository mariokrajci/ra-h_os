export function hasNodeSetChanged(newIds: number[], storedIds: number[]): boolean {
  if (newIds.length !== storedIds.length) return true;
  const stored = new Set(storedIds);
  return newIds.some((id) => !stored.has(id));
}
