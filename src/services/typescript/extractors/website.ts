/**
 * Website content extraction for RA-H knowledge management system
 * Extracts text content from web pages and returns formatted content
 */

import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

interface WebsiteMetadata {
  title: string;
  author?: string;
  date?: string;
  description?: string;
  og_image?: string;
  site_name?: string;
  extraction_method?: string;
}

interface ExtractionResult {
  content: string;
  chunk: string;
  metadata: WebsiteMetadata;
  url: string;
}

type RstReferenceMap = Map<string, string>;

const GITHUB_README_COMMUNITY_LINE_PATTERNS: RegExp[] = [
  /^\s*English\s*\/\s*中文\s*$/i,
  /^\s*Join the Community\s*$/i,
  /\b(Lark Group|WeChat Group|Discord|X\s*\(Twitter\)|Join Discord Server|Follow us|View QR Code)\b/i,
  /\b(scan the qr code|join our community|sincerely invite every developer|future of ai agent context management)\b/i,
];

function isGitHubReadmeCommunityNoise(line: string): boolean {
  return GITHUB_README_COMMUNITY_LINE_PATTERNS.some((pattern) => pattern.test(line.trim()));
}

const UI_NOISE_PATTERNS: RegExp[] = [
  /\b(sign in|log in|notifications|watch|fork|star)\b/i,
  /\b(pull requests?|issues?|releases?|packages|contributors?)\b/i,
  /\b(latest commit|view all files|repository files navigation)\b/i,
  /\b(cookie policy|privacy policy|terms of service)\b/i,
  /\b(there was an error while loading|please reload this page)\b/i,
  /^\s*(home|about|pricing|contact|search|menu)\s*$/i,
];

const GITHUB_README_SELECTORS = [
  '#readme article.markdown-body',
  'article.markdown-body.entry-content',
  '.repository-content article.markdown-body',
  '.Box-body article.markdown-body',
];

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function isLikelyNoise(line: string): boolean {
  if (!line) return true;
  if (line.length < 20) return true;
  if (line.length > 500) return false;
  return UI_NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

export function sanitizeWebsiteText(raw: string): string {
  const lines = raw
    .split('\n')
    .map(normalizeLine)
    .filter((line) => line.length > 0);

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (isLikelyNoise(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(line);
  }

  // If filtering is too aggressive, keep the best-effort normalized content.
  if (deduped.length < 3) {
    return lines.join('\n\n').slice(0, 120_000);
  }

  return deduped.join('\n\n').slice(0, 120_000);
}

function buildRstReferenceMap(raw: string): RstReferenceMap {
  const refs = new Map<string, string>();
  const refRegex = /^\.\.\s+_([^:]+):\s+(https?:\/\/\S+)\s*$/gm;

  for (const match of raw.matchAll(refRegex)) {
    const label = match[1]?.trim();
    const url = match[2]?.trim();
    if (label && url) refs.set(label, url);
  }

  return refs;
}

function replaceRstReferenceLinks(line: string, refs: RstReferenceMap): string {
  let output = line;

  for (const [label, url] of refs.entries()) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[\\s(])(${escapedLabel})_(?=[\\s).,:;!?]|$)`, 'g');
    output = output.replace(pattern, `$1[$2](${url})`);
  }

  return output;
}

export function sanitizeGitHubReadmeRst(raw: string): string {
  const refs = buildRstReferenceMap(raw);
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inCodeBlock = false;
  let skipCommunitySection = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    const next = lines[i + 1] ?? '';
    const nextTrimmed = next.trim();

    if (!trimmed) {
      if (skipCommunitySection) {
        continue;
      }
      if (inCodeBlock) {
        out.push('');
      } else if (out[out.length - 1] !== '') {
        out.push('');
      }
      continue;
    }

    if (/^\.\.\s+\|[^|]+\|\s+image::/i.test(trimmed)) {
      while (i + 1 < lines.length && /^\s+:\w+:/i.test(lines[i + 1])) i += 1;
      continue;
    }

    if (skipCommunitySection) {
      if (/^[=~`\-^:#*+]{3,}\s*$/.test(nextTrimmed) && trimmed.length > 0) {
        skipCommunitySection = false;
      } else if (isGitHubReadmeCommunityNoise(trimmed)) {
        continue;
      } else {
        continue;
      }
    }

    if (/^\|[^|]+\|(?:\s+\|[^|]+\|)*\s*$/.test(trimmed)) {
      continue;
    }

    if (/^\.\.\s+_[^:]+:\s+https?:\/\//i.test(trimmed)) {
      continue;
    }

    if (isGitHubReadmeCommunityNoise(trimmed)) {
      skipCommunitySection = true;
      continue;
    }

    const codeDirectiveMatch = trimmed.match(/^\.\.\s+code::\s*([A-Za-z0-9_+-]+)?\s*$/i);
    if (codeDirectiveMatch) {
      const codeLanguage = codeDirectiveMatch[1]?.toLowerCase() || '';
      out.push(`\`\`\`${codeLanguage}`);
      inCodeBlock = true;
      continue;
    }

    if (inCodeBlock) {
      if (/^\s{4,}|\t/.test(line)) {
        out.push(line.replace(/^(?:\s{4}|\t)/, ''));
        continue;
      }

      out.push('```');
      inCodeBlock = false;
      i -= 1;
      continue;
    }

    if (/^[=~`\-^:#*+]{3,}\s*$/.test(nextTrimmed) && trimmed.length > 0) {
      const marker = nextTrimmed[0];
      const headingLevel = marker === '=' ? '# ' : '## ';
      out.push(`${headingLevel}${replaceRstReferenceLinks(trimmed, refs)}`);
      i += 1;
      continue;
    }

    let normalized = replaceRstReferenceLinks(line, refs)
      .replace(/``([^`]+)``/g, '`$1`')
      .replace(/^\.\.\s+note::\s*/i, '> ')
      .replace(/^\.\.\s+warning::\s*/i, '> Warning: ');

    if (/^\s*[-*+]\s+/.test(normalized)) {
      normalized = normalized.replace(/^\s*([-*+])\s+/, '- ');
    }

    out.push(normalized);
  }

  if (inCodeBlock) {
    out.push('```');
  }

  const normalized: string[] = [];
  let previousBlank = false;
  for (const line of out) {
    const blank = line.trim().length === 0;
    if (blank && previousBlank) continue;
    normalized.push(line);
    previousBlank = blank;
  }

  return normalized.join('\n').trim().slice(0, 200_000);
}

export function deriveGitHubReadmeTitle(repoSlug: string, markdown: string): string {
  // Match any heading level (not just h1)
  const headingMatch = markdown.match(/^\s*#+\s+(.+?)\s*$/m);
  // Skip lines starting with HTML tags or `#`
  const firstLineMatch = markdown.match(/^\s*([^\n#<][^\n]{3,160})\s*$/m);
  const rawCandidate = (headingMatch?.[1] || firstLineMatch?.[1] || '').trim();
  // Strip any inline HTML that may appear in the candidate (e.g. <img>, <a>)
  const candidate = rawCandidate.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  if (!candidate) {
    return repoSlug;
  }

  const normalized = candidate
    .replace(/\s+/g, ' ')
    .replace(/^README\s*[:\-]\s*/i, '')
    .trim();

  return normalized || repoSlug;
}

export class WebsiteExtractor {
  private headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  };
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      strongDelimiter: '**',
    });
  }

  /**
   * Extract content using Jina.ai Reader API
   * Used as fallback when cheerio fails (JS-rendered sites, Twitter, SPAs)
   * Free tier: 20 requests/minute per IP (no API key needed)
   */
  private async extractWithJina(url: string): Promise<ExtractionResult> {
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      headers: { 'User-Agent': 'RA-H/1.0' },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Jina extraction failed: ${response.status}`);
    }

    const markdown = await response.text();

    // Parse title from first markdown heading or first non-HTML line
    const titleMatch = markdown.match(/^\s*#+\s+(.+)$/m) || markdown.match(/^\s*([^\n#<][^\n]{3,160})$/m);
    const rawTitle = titleMatch?.[1]?.trim() ?? '';
    const title = (rawTitle.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()) || 'Extracted Content';

    const cleanedMarkdown = this.cleanMarkdown(markdown);

    // Build metadata
    const metadata: WebsiteMetadata = {
      title,
      extraction_method: 'jina',
    };

    // Format content consistently with cheerio output
    const content = this.formatContent(metadata, cleanedMarkdown);

    return {
      content,
      chunk: cleanedMarkdown,
      metadata,
      url,
    };
  }

  private parseGitHubRepo(url: string): { owner: string; repo: string } | null {
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'github.com') return null;
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length < 2) return null;
      const owner = segments[0];
      const repo = segments[1].replace(/\.git$/i, '');
      if (!owner || !repo) return null;
      return { owner, repo };
    } catch {
      return null;
    }
  }

  /**
   * Extract raw README markdown from GitHub API.
   * This preserves markdown/code blocks and avoids scraping noisy repo chrome.
   */
  private async extractWithGitHubReadme(url: string): Promise<ExtractionResult | null> {
    const repo = this.parseGitHubRepo(url);
    if (!repo) return null;

    const apiUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/readme`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'RA-H/1.0',
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      name?: string;
      content?: string;
      encoding?: string;
      html_url?: string;
    };

    let markdown = '';
    if (typeof data.content === 'string' && data.encoding === 'base64') {
      markdown = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    }

    if (!markdown.trim()) {
      return null;
    }

    const metadata: WebsiteMetadata = {
      title: deriveGitHubReadmeTitle(`${repo.owner}/${repo.repo}`, markdown),
      site_name: 'GitHub',
      extraction_method: 'github_readme_api',
      description: data.name ? `Repository README (${data.name})` : 'Repository README',
    };

    const isRstReadme = typeof data.name === 'string' && /\.rst$/i.test(data.name);
    const cleanedMarkdown = isRstReadme
      ? sanitizeGitHubReadmeRst(markdown)
      : this.cleanMarkdown(markdown);

    return {
      content: this.formatContent(metadata, cleanedMarkdown),
      chunk: cleanedMarkdown.slice(0, 200_000),
      metadata,
      url: data.html_url || url,
    };
  }

  /**
   * Clean extracted content for better readability
   */
  private cleanContent(content: string): string {
    return sanitizeWebsiteText(content);
  }

  /**
   * Keep markdown structure intact while removing obvious UI noise lines.
   */
  private cleanMarkdown(markdown: string): string {
    const headingToMarkdown = (_match: string, level: string, inner: string) => {
      const text = inner
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!text) return '\n';
      return `\n${'#'.repeat(Number(level))} ${text}\n`;
    };

    const cleanedHtmlish = markdown
      .replace(/\r\n/g, '\n')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, headingToMarkdown)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      .replace(/<img\s+[^>]*>/gi, '')
      .replace(/<\/?(p|div|span|center|strong|em|b|i|u)[^>]*>/gi, '')
      .replace(/<\/?h([1-6])[^>]*>/gi, '');

    const lines = cleanedHtmlish.split('\n');
    const out: string[] = [];
    let inFence = false;

    for (const originalLine of lines) {
      const line = originalLine.replace(/\u00a0/g, ' ');
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        inFence = !inFence;
        out.push(trimmed);
        continue;
      }

      if (inFence) {
        out.push(line);
        continue;
      }

      if (!trimmed) {
        out.push('');
        continue;
      }

      if (UI_NOISE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        continue;
      }

      out.push(line);
    }

    const normalized: string[] = [];
    let previousBlank = false;
    for (const line of out) {
      const blank = line.trim().length === 0;
      if (blank && previousBlank) continue;
      normalized.push(line);
      previousBlank = blank;
    }

    return normalized.join('\n').trim().slice(0, 200_000);
  }

  private htmlToMarkdown(html: string): string {
    const converted = this.turndown.turndown(html);
    return this.cleanMarkdown(converted);
  }

  /**
   * Extract metadata from HTML
   */
  private extractMetadata($: cheerio.CheerioAPI): WebsiteMetadata {
    const metadata: WebsiteMetadata = {
      title: '',
    };
    
    // Title extraction (priority order)
    metadata.title = 
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      $('h1').first().text() ||
      'Untitled';
    
    // Author extraction
    metadata.author = 
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      $('.author').first().text() ||
      $('[rel="author"]').first().text() ||
      undefined;
    
    // Date extraction
    metadata.date = 
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="publish_date"]').attr('content') ||
      $('time').first().attr('datetime') ||
      $('.date').first().text() ||
      undefined;
    
    // Description
    metadata.description = 
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      undefined;
    
    // Image
    metadata.og_image = 
      $('meta[property="og:image"]').attr('content') ||
      undefined;
    
    // Site name
    metadata.site_name = 
      $('meta[property="og:site_name"]').attr('content') ||
      undefined;
    
    return metadata;
  }

  /**
   * Extract main content from HTML
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // Remove script and style elements
    $('script, style, noscript').remove();

    // Remove common navigation and footer elements
    $(
      'nav, header, footer, aside, .nav, .header, .footer, .sidebar, .menu, .advertisement,' +
      '[aria-label*="navigation" i], [aria-label*="menu" i], .breadcrumb, .breadcrumbs'
    ).remove();

    // GitHub repositories are noisy; prioritize README markdown body.
    for (const selector of GITHUB_README_SELECTORS) {
      const readme = $(selector).first();
      if (readme.length > 0) {
        const readmeHtml = readme.html();
        if (readmeHtml && readmeHtml.length > 100) {
          const markdown = this.htmlToMarkdown(readmeHtml);
          if (markdown.length > 200) {
            return markdown;
          }
        }
      }
    }

    // Try to find main content areas (in priority order)
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.markdown-body',
      '.prose',
      '.content',
      '.post',
      '.article-body',
      '.entry-content',
      '#content',
      '.container',
      'body',
    ];
    
    let mainContent = '';
    
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const cloned = element.clone();
        cloned.find('nav, header, footer, aside, .nav, .header, .footer, .sidebar, .menu, .advertisement, .breadcrumb, .breadcrumbs').remove();
        const html = cloned.html();
        if (html && html.trim().length > 0) {
          const markdown = this.htmlToMarkdown(html);
          if (markdown.length > 200) {
            mainContent = markdown;
            break;
          }
        }
      }
    }
    
    // Fallback to all text if no main content found
    if (!mainContent) {
      const bodyHtml = $('body').html() || '';
      if (bodyHtml.trim()) {
        mainContent = this.htmlToMarkdown(bodyHtml);
      } else {
        mainContent = this.cleanContent($('body').text());
      }
    }

    return mainContent;
  }

  /**
   * Format content for node creation
   */
  private formatContent(metadata: WebsiteMetadata, mainContent: string): string {
    const sections: string[] = [];
    
    // Add metadata section
    sections.push('## Article Information');
    sections.push(`**Title:** ${metadata.title}`);
    
    if (metadata.author) {
      sections.push(`**Author:** ${metadata.author}`);
    }
    
    if (metadata.date) {
      sections.push(`**Date:** ${metadata.date}`);
    }
    
    if (metadata.site_name) {
      sections.push(`**Source:** ${metadata.site_name}`);
    }
    
    if (metadata.description) {
      sections.push(`**Description:** ${metadata.description}`);
    }
    
    sections.push('');
    
    // Add main content
    sections.push('## Content');
    sections.push(mainContent);
    
    return sections.join('\n');
  }

  /**
   * Extract content using cheerio (static HTML parser)
   * Fast, free, no external calls - but fails on JS-rendered sites
   */
  private async extractWithCheerio(url: string): Promise<ExtractionResult> {
    const response = await fetch(url, {
      headers: this.headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const metadata = this.extractMetadata($);
    metadata.extraction_method = 'cheerio';
    const mainContent = this.extractMainContent($);

    const content = this.formatContent(metadata, mainContent);

    return {
      content,
      chunk: mainContent,
      metadata,
      url,
    };
  }

  /**
   * Main extraction method
   * Strategy: Try cheerio first (fast, free), fall back to Jina for JS-rendered sites
   */
  async extract(url: string): Promise<ExtractionResult> {
    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Invalid URL format - must start with http:// or https://');
    }

    // GitHub repositories: prefer raw README markdown via API.
    try {
      const githubReadme = await this.extractWithGitHubReadme(url);
      if (githubReadme && githubReadme.chunk.length > 100) {
        return githubReadme;
      }
    } catch (error: any) {
      console.log('[WebsiteExtractor] GitHub README extraction failed, falling back...', error?.message || error);
    }

    // Try cheerio first (fast, no external call)
    try {
      const result = await this.extractWithCheerio(url);

      // If content is substantial, cheerio worked
      if (result.chunk.length > 200) {
        return result;
      }

      console.log('[WebsiteExtractor] Cheerio extraction too short, trying Jina...');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - website took too long to respond');
      }
      console.log('[WebsiteExtractor] Cheerio failed, trying Jina...', error.message);
    }

    // Fallback to Jina for JS-rendered sites
    try {
      return await this.extractWithJina(url);
    } catch (jinaError: any) {
      throw new Error(`Extraction failed: ${jinaError.message}`);
    }
  }
}

/**
 * Standalone extraction function for direct use
 */
export async function extractWebsite(url: string): Promise<ExtractionResult> {
  const extractor = new WebsiteExtractor();
  return extractor.extract(url);
}

/**
 * CLI interface for direct execution
 */
export async function runCLI(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: website-extract <url>');
    process.exit(1);
  }
  
  const url = args[0];
  
  try {
    const result = await extractWebsite(url);
    // Output as JSON for compatibility with existing tools
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly (for testing)
if (require.main === module) {
  runCLI(process.argv.slice(2)).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
