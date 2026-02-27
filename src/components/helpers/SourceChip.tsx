"use client";

import { Github, Mic2 } from 'lucide-react';
import { extractDomain, getFaviconUrl, getLinkIconKind } from '@/utils/nodeIcons';

interface SourceChipProps {
  url?: string;
  domain?: string;
}

export default function SourceChip({ url, domain }: SourceChipProps) {
  const d = extractDomain(domain || url);
  const favicon = d ? getFaviconUrl(d, 12) : '';
  const kind = getLinkIconKind(url || domain);
  return (
    <span
      title={url || d}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: 999,
        padding: '2px 8px',
        fontSize: 11,
        color: '#bdbdbd',
        lineHeight: 1
      }}
    >
      {kind === 'github' ? (
        <Github size={12} color="#bdbdbd" />
      ) : kind === 'podcast' ? (
        <Mic2 size={12} color="#bdbdbd" />
      ) : d ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={favicon}
          alt=""
          width={12}
          height={12}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
          style={{ borderRadius: 2 }}
        />
      ) : null}
      <span>{d || 'source'}</span>
    </span>
  );
}
