"use client";

import { useState } from 'react';
import type { Node } from '@/types/database';
import ProgressRing from './ProgressRing';
import { getBookStatusHint } from './bookStatus';

interface BookCardProps {
  node: Node;
  onOpen: (node: Node) => void;
}

function gradientForTitle(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash |= 0;
  }
  const a = Math.abs(hash) % 360;
  const b = (a + 48) % 360;
  return `linear-gradient(135deg, hsl(${a} 55% 42%), hsl(${b} 45% 24%))`;
}

export default function BookCard({ node, onOpen }: BookCardProps) {
  const [imgError, setImgError] = useState(false);
  const title = node.metadata?.book_title || node.title;
  const author = node.metadata?.book_author;
  const cover = !imgError ? node.metadata?.cover_url : null;
  const percent = node.metadata?.reading_progress?.percent ?? 0;
  const statusHint = getBookStatusHint(node.metadata);

  return (
    <button
      onClick={() => onOpen(node)}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            width: '100%',
            aspectRatio: '2 / 3',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 10px 28px rgba(0,0,0,0.25)',
            background: gradientForTitle(title),
          }}
        >
          {cover ? (
            <img
              src={cover}
              alt={title}
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ padding: '18px', color: 'rgba(255,255,255,0.92)', fontSize: '14px', lineHeight: 1.35 }}>
              {title}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#e5e5e5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </div>
            {author ? (
              <div style={{ fontSize: '11px', color: '#7a7a7a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {author}
              </div>
            ) : null}
            {statusHint ? (
              <div
                style={{
                  marginTop: '4px',
                  fontSize: '10px',
                  color: statusHint.tone === 'warning' ? '#d9a441' : '#6a6a6a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={statusHint.label}
              >
                {statusHint.label}
              </div>
            ) : null}
          </div>
          <ProgressRing percent={percent} />
        </div>
      </div>
    </button>
  );
}
