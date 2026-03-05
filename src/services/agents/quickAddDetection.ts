export type QuickAddMode = 'link' | 'note' | 'chat';

export type QuickAddInputType = 'youtube' | 'podcast' | 'website' | 'pdf' | 'note' | 'chat';

function normalizeUrlLikeInput(raw: string): string {
  const input = raw.trim();
  if (!input) return input;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return input;
  if (/\s/.test(input)) return input;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(input)) {
    return `https://${input}`;
  }
  return input;
}

export function detectInputType(raw: string, mode?: QuickAddMode): QuickAddInputType {
  if (mode === 'chat') return 'chat';
  if (mode === 'note') return 'note';

  const input = normalizeUrlLikeInput(raw);
  if (/youtu(\.be|be\.com)/i.test(input)) return 'youtube';
  if (
    /open\.spotify\.com\/episode/i.test(input) ||
    /podcasts\.apple\.com/i.test(input) ||
    /pca\.st\//i.test(input) ||
    /play\.pocketcasts\.com/i.test(input) ||
    /feeds\.[a-z0-9-]+\.(com|fm|net|io)/i.test(input) ||
    /\/(feed|rss)(\/|$|\?)/i.test(input)
  ) return 'podcast';
  if (/\.pdf($|\?)/i.test(input) || /arxiv\.org\//i.test(input)) return 'pdf';
  if (/^https?:\/\//i.test(input)) return 'website';
  return 'note';
}
