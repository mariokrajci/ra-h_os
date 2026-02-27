"use client";

import { useState } from 'react';
import { Video, FileText, File, Globe, Folder, Github, Mic2 } from 'lucide-react';
import { Node } from '@/types/database';
import { getIconByName } from '@/components/common/LucideIconPicker';

interface FaviconIconProps {
  domain: string;
  size?: number;
}

export type LinkIconKind = 'youtube' | 'podcast' | 'pdf' | 'github' | 'favicon' | 'globe';

const NO_FAVICON_DOMAINS = new Set(['example.com', 'www.example.com', 'localhost', '127.0.0.1', '0.0.0.0']);

export function shouldFetchFavicon(domain: string): boolean {
  const normalized = (domain || '').toLowerCase().trim();
  if (!normalized) return false;
  return !NO_FAVICON_DOMAINS.has(normalized);
}

export function getFaviconUrl(domain: string, size: number = 16): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

export function extractDomain(input?: string): string {
  if (!input) return '';
  try {
    const d = input.includes('://') ? new URL(input).hostname : input;
    return d.replace(/^www\./, '');
  } catch {
    return input.replace(/^www\./, '');
  }
}

function normalizeUrlishInput(input?: string): string {
  const trimmed = input?.trim() || '';
  if (!trimmed) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (/\s/.test(trimmed)) return trimmed;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function getLinkIconKind(url?: string, metadataType?: string | null): LinkIconKind {
  if (!url) return 'globe';

  const normalizedUrl = normalizeUrlishInput(url);
  const normalized = normalizedUrl.toLowerCase();

  if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) {
    return 'youtube';
  }

  if (
    normalized.includes('open.spotify.com/episode') ||
    normalized.includes('podcasts.apple.com') ||
    normalized.includes('pca.st/') ||
    normalized.includes('play.pocketcasts.com') ||
    normalized.includes('/feed') ||
    normalized.includes('/rss')
  ) {
    return 'podcast';
  }

  if (normalized.includes('github.com')) {
    return 'github';
  }

  if (normalized.endsWith('.pdf') || metadataType === 'paper') {
    return 'pdf';
  }

  try {
    const domain = new URL(normalizedUrl).hostname;
    return shouldFetchFavicon(domain) ? 'favicon' : 'globe';
  } catch {
    return 'globe';
  }
}

const FaviconIcon = ({ domain, size = 16 }: FaviconIconProps) => {
  const [failed, setFailed] = useState(false);

  if (failed || !shouldFetchFavicon(domain)) {
    return <Globe size={size} color="#94a3b8" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getFaviconUrl(domain, size)}
      width={size}
      height={size}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
};

/**
 * Resolve the icon for a node.
 *
 * Priority:
 * 1. URL-derived icon (favicon, YouTube, PDF) — if node has a link
 * 2. Dimension-derived icon — from the node's most popular dimension that has an icon set
 * 3. Fallback to generic File icon
 *
 * @param node - The database node
 * @param dimensionIcons - Map of dimension name → Lucide icon name (from DimensionIconsContext)
 * @param size - Icon size in px (default 16)
 */
export function getNodeIcon(
  node: Node,
  dimensionIcons?: Record<string, string>,
  size: number = 16,
): React.ReactElement {
  // If node has a link, use URL-derived icon (primary)
  if (node.link) {
    const kind = getLinkIconKind(node.link, node.metadata?.type);

    if (kind === 'youtube') {
      return <Video size={size} color="#FF0000" />;
    }

    if (kind === 'github') {
      return <Github size={size} color="#94a3b8" />;
    }

    if (kind === 'podcast') {
      return <Mic2 size={size} color="#94a3b8" />;
    }

    if (kind === 'pdf') {
      return <FileText size={size} color="#94a3b8" />;
    }

    if (kind === 'favicon') {
      try {
        const domain = new URL(node.link).hostname;
        return <FaviconIcon domain={domain} size={size} />;
      } catch {
        return <Globe size={size} color="#94a3b8" />;
      }
    }

    return <Globe size={size} color="#94a3b8" />;
  }

  // No link — try dimension-derived icon
  if (dimensionIcons && node.dimensions?.length) {
    // Find the first dimension that has an icon set
    // (dimensions are already ordered, so first match wins)
    for (const dim of node.dimensions) {
      const iconName = dimensionIcons[dim];
      if (iconName && iconName !== 'Folder') {
        const IconComponent = getIconByName(iconName);
        return <IconComponent size={size} color="#94a3b8" />;
      }
    }
  }

  // Fallback
  return <File size={size} color="#94a3b8" />;
}

/**
 * Get the dimension icon for a given dimension name.
 * Returns Folder if no icon is set.
 */
export function getDimensionIcon(
  dimensionName: string,
  dimensionIcons: Record<string, string>,
  size: number = 16,
): React.ReactElement {
  const iconName = dimensionIcons[dimensionName] || 'Folder';
  const IconComponent = getIconByName(iconName);
  return <IconComponent size={size} color="#94a3b8" />;
}
