import { bundledLanguages, codeToTokens, type BundledLanguage } from 'shiki';

export interface HighlightToken {
  content: string;
  color?: string;
  fontStyle?: number;
}

export interface HighlightResult {
  normalizedLanguage: string | null;
  lines: HighlightToken[][] | null;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  text: 'plaintext',
  txt: 'plaintext',
};

const SUPPORTED_LANGUAGES = new Set<string>(Object.keys(bundledLanguages));
const highlightCache = new Map<string, Promise<HighlightResult>>();

export function normalizeHighlightLanguage(language?: string | null): string | null {
  if (!language) return null;
  const lower = language.toLowerCase();
  return LANGUAGE_ALIASES[lower] ?? lower;
}

export async function highlightCodeTokens(
  code: string,
  language?: string | null,
  themeName: 'horizon' | 'github-light' = 'horizon'
): Promise<HighlightResult> {
  const normalizedLanguage = normalizeHighlightLanguage(language);

  if (!normalizedLanguage || !SUPPORTED_LANGUAGES.has(normalizedLanguage)) {
    return {
      normalizedLanguage,
      lines: null,
    };
  }

  const cacheKey = `${themeName}\u0000${normalizedLanguage}\u0000${code}`;
  const cached = highlightCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = codeToTokens(code, {
    lang: normalizedLanguage as BundledLanguage,
    theme: themeName,
  }).then((result) => ({
    normalizedLanguage,
    lines: result.tokens.map((line) =>
      line.map((token) => ({
        content: token.content,
        color: token.color,
        fontStyle: token.fontStyle,
      }))
    ),
  }));

  highlightCache.set(cacheKey, pending);
  return pending;
}
