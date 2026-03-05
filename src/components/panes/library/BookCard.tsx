"use client";

import { useState } from 'react';
import type { Node } from '@/types/database';
import ProgressRing from './ProgressRing';
import { getBookStatusHint } from './bookStatus';
import { getBookMatchCandidates, type BookMatchCandidate } from './bookMatch';

interface BookCardProps {
  node: Node;
  onOpen: (node: Node) => void;
  onConfirmMatch?: (node: Node, candidate: BookMatchCandidate) => Promise<void> | void;
  onRetryMetadata?: (node: Node) => Promise<void> | void;
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

export default function BookCard({ node, onOpen, onConfirmMatch, onRetryMetadata }: BookCardProps) {
  const [imgError, setImgError] = useState(false);
  const title = node.metadata?.book_title || node.title;
  const author = node.metadata?.book_author;
  const cover = !imgError ? node.metadata?.cover_url : null;
  const percent = node.metadata?.reading_progress?.percent ?? 0;
  const statusHint = getBookStatusHint(node.metadata);
  const candidates = getBookMatchCandidates(node.metadata);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const selectedCandidate = candidates[selectedCandidateIndex] || candidates[0] || null;

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
            {statusHint?.label === 'Confirm book match' && selectedCandidate && onConfirmMatch ? (
              <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                {candidates.length > 1 ? (
                  <select
                    value={String(selectedCandidateIndex)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setSelectedCandidateIndex(Number(event.target.value))}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      background: 'rgba(20,20,20,0.75)',
                      color: '#d5d5d5',
                      border: '1px solid rgba(217,164,65,0.35)',
                      borderRadius: '6px',
                      fontSize: '10px',
                      padding: '2px 4px',
                    }}
                  >
                    {candidates.map((candidate, index) => (
                      <option key={`${candidate.title}-${index}`} value={index}>
                        {candidate.title}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onConfirmMatch(node, selectedCandidate);
                  }}
                  style={{
                    border: '1px solid rgba(217,164,65,0.45)',
                    background: 'rgba(217,164,65,0.12)',
                    color: '#d9a441',
                    borderRadius: '6px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  Confirm
                </button>
              </div>
            ) : null}
            {statusHint?.label === 'Add author/ISBN to improve match' && onRetryMetadata ? (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onRetryMetadata(node);
                }}
                style={{
                  marginTop: '6px',
                  border: '1px solid rgba(106,106,106,0.45)',
                  background: 'rgba(106,106,106,0.12)',
                  color: '#b8b8b8',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            ) : null}
          </div>
          <ProgressRing percent={percent} />
        </div>
      </div>
    </button>
  );
}
